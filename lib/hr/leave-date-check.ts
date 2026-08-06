import { loadEffectiveHolidayCalendar } from "@/lib/hr/effective-calendar";
import { countWorkingLeaveDays } from "@/lib/hr/leave-balance";
import type { SupabaseClient } from "@supabase/supabase-js";

const WEEKEND_SAT = 6;
const WEEKEND_SUN = 0;

export interface LeaveDateAnalysis {
  workingDays: number;
  weekendDates: string[];
  holidayHits: Array<{ date: string; name: string }>;
  warnings: string[];
}

function eachDateInRange(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (end < start) return out;
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export async function analyzeLeaveDateRange(
  supabase: SupabaseClient,
  businessId: string,
  startDate: string,
  endDate: string,
): Promise<LeaveDateAnalysis> {
  const { holidayByDate, nonWorkingDates: holidayDates } =
    await loadEffectiveHolidayCalendar(supabase, businessId);

  const weekendDates: string[] = [];
  const holidayHits: Array<{ date: string; name: string }> = [];
  for (const iso of eachDateInRange(startDate, endDate)) {
    const dow = new Date(`${iso}T12:00:00`).getDay();
    if (dow === WEEKEND_SAT || dow === WEEKEND_SUN) {
      weekendDates.push(iso);
    }
    const holidayName = holidayByDate.get(iso);
    if (holidayName) {
      holidayHits.push({ date: iso, name: holidayName });
    }
  }

  const workingDays = countWorkingLeaveDays(startDate, endDate, holidayDates);
  const warnings: string[] = [];
  if (weekendDates.length > 0) {
    warnings.push(
      `${weekendDates.length} day(s) in the range fall on a weekend and are not counted as leave.`,
    );
  }
  if (holidayHits.length > 0) {
    const names = holidayHits
      .slice(0, 3)
      .map((h) => `${h.name} (${h.date})`)
      .join("; ");
    warnings.push(
      `Public holiday(s) in range: ${names}${holidayHits.length > 3 ? "…" : ""}.`,
    );
  }
  if (workingDays === 0) {
    warnings.push(
      "No working days in this range — check dates before approving annual leave.",
    );
  }

  return { workingDays, weekendDates, holidayHits, warnings };
}

export async function loadHolidayDateSetForBusiness(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Set<string>> {
  const { loadEffectiveHolidayDateSet } = await import(
    "@/lib/hr/effective-calendar"
  );
  return loadEffectiveHolidayDateSet(supabase, businessId);
}
