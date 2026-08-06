import "server-only";

import {
  loadEffectiveHolidayCalendar,
  type EffectiveHolidayEntry,
} from "@/lib/hr/effective-calendar";
import type { SupabaseClient } from "@supabase/supabase-js";

const MY_TZ = "Asia/Kuala_Lumpur";

export interface BookingHolidayConflict {
  date: string;
  name: string;
}

function isoDateInMalaysia(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoTimestamp));
}

function eachDateInRange(startIso: string, endIso: string): string[] {
  const start = isoDateInMalaysia(startIso);
  const end = isoDateInMalaysia(endIso);
  const out: string[] = [];
  const cursor = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  if (endDate < cursor) return out;

  while (cursor <= endDate) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function hitsForRange(
  dates: string[],
  holidayByDate: Map<string, string>,
): BookingHolidayConflict[] {
  const conflicts: BookingHolidayConflict[] = [];
  for (const date of dates) {
    const name = holidayByDate.get(date);
    if (name) {
      conflicts.push({ date, name });
    }
  }
  return conflicts;
}

/** Block bookings that fall on public holidays or company closures. */
export async function findBookingHolidayConflicts(
  supabase: SupabaseClient,
  businessId: string,
  args: { startsAt: string; endsAt: string },
): Promise<BookingHolidayConflict[]> {
  const calendar = await loadEffectiveHolidayCalendar(supabase, businessId);
  const dates = eachDateInRange(args.startsAt, args.endsAt);
  return hitsForRange(dates, calendar.holidayByDate);
}

export function formatHolidayConflictMessage(
  conflicts: BookingHolidayConflict[],
): string {
  const c = conflicts[0];
  if (!c) return "Booking falls on a non-working day.";
  const extra =
    conflicts.length > 1 ? ` (+${conflicts.length - 1} more day(s))` : "";
  return `${c.name} (${c.date}) — shop is closed.${extra}`;
}

export function listUpcomingClosures(
  entries: EffectiveHolidayEntry[],
  fromDate = new Date().toISOString().slice(0, 10),
): EffectiveHolidayEntry[] {
  return entries.filter((e) => e.date >= fromDate);
}
