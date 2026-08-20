import type { SupabaseClient } from "@supabase/supabase-js";

export type OpenBookingOverlap = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
};

export function datesOverlapInclusive(
  leaveStart: string,
  leaveEnd: string,
  bookingStartYmd: string,
  bookingEndYmd: string,
): boolean {
  return leaveStart <= bookingEndYmd && leaveEnd >= bookingStartYmd;
}

export function filterOverlappingBookings<
  T extends {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    status: string;
  },
>(
  bookings: ReadonlyArray<T>,
  leaveStart: string,
  leaveEnd: string,
): OpenBookingOverlap[] {
  return bookings
    .filter((b) => b.status !== "cancelled")
    .filter((b) =>
      datesOverlapInclusive(
        leaveStart,
        leaveEnd,
        b.startsAt.slice(0, 10),
        b.endsAt.slice(0, 10),
      ),
    )
    .map((b) => ({
      id: b.id,
      title: b.title,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
    }));
}

/**
 * Open (non-cancelled) bookings for resources linked to this employee that
 * overlap the leave date range.
 */
export async function findOpenBookingsOverlappingLeave(
  supabase: SupabaseClient,
  businessId: string,
  input: { employeeId: string; startDate: string; endDate: string },
): Promise<OpenBookingOverlap[]> {
  const { data: resources } = await supabase
    .from("operations_booking_resources")
    .select("id")
    .eq("business_id", businessId)
    .eq("employee_id", input.employeeId)
    .is("deleted_at", null);

  const resourceIds = (resources ?? []).map((r) => r.id as string);
  if (resourceIds.length === 0) return [];

  const { data: bookings } = await supabase
    .from("operations_bookings")
    .select("id, service_title, starts_at, ends_at, status")
    .eq("business_id", businessId)
    .in("resource_id", resourceIds)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .lte("starts_at", `${input.endDate}T23:59:59.999Z`)
    .gte("ends_at", `${input.startDate}T00:00:00.000Z`);

  return filterOverlappingBookings(
    (bookings ?? []).map((row) => ({
      id: row.id as string,
      title: (row.service_title as string) || "Booking",
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
      status: row.status as string,
    })),
    input.startDate,
    input.endDate,
  );
}
