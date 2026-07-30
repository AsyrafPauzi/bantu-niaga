import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface BookingSlotInput {
  resourceId: string;
  startsAt: string;
  endsAt: string;
  excludeBookingId?: string;
}

export interface BookingConflict {
  bookingId: string;
  number: string;
  startsAt: string;
  endsAt: string;
  bufferMinutes: number;
}

/**
 * Check whether a proposed booking overlaps existing bookings on the same
 * resource, including buffer_minutes cleanup time after each booking.
 */
export async function findBookingConflicts(
  supabase: SupabaseClient,
  businessId: string,
  input: BookingSlotInput,
): Promise<BookingConflict[]> {
  const { data: resource } = await supabase
    .from("operations_booking_resources")
    .select("buffer_minutes")
    .eq("id", input.resourceId)
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .maybeSingle();

  const bufferMinutes = resource?.buffer_minutes ?? 0;
  const bufferMs = bufferMinutes * 60_000;

  const proposedStart = new Date(input.startsAt).getTime();
  const proposedEnd = new Date(input.endsAt).getTime();
  if (Number.isNaN(proposedStart) || Number.isNaN(proposedEnd)) {
    return [];
  }
  if (proposedEnd <= proposedStart) {
    return [];
  }

  // Load bookings on this resource (±1 day window for index efficiency).
  const windowStart = new Date(proposedStart - 24 * 60 * 60_000).toISOString();
  const windowEnd = new Date(proposedEnd + 24 * 60 * 60_000).toISOString();

  let query = supabase
    .from("operations_bookings")
    .select("id, number, starts_at, ends_at, status")
    .eq("business_id", businessId)
    .eq("resource_id", input.resourceId)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .gte("ends_at", windowStart)
    .lte("starts_at", windowEnd);

  if (input.excludeBookingId) {
    query = query.neq("id", input.excludeBookingId);
  }

  const { data: existing } = await query;

  const conflicts: BookingConflict[] = [];

  for (const row of existing ?? []) {
    const existingStart = new Date(row.starts_at as string).getTime();
    const existingEnd = new Date(row.ends_at as string).getTime();
    const blockedEnd = existingEnd + bufferMs;
    const blockedStart = existingStart;

    // Overlap if proposed slot intersects [blockedStart, blockedEnd]
    if (proposedStart < blockedEnd && proposedEnd > blockedStart) {
      conflicts.push({
        bookingId: row.id as string,
        number: row.number as string,
        startsAt: row.starts_at as string,
        endsAt: row.ends_at as string,
        bufferMinutes,
      });
    }
  }

  return conflicts;
}
