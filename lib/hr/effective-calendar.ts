import "server-only";

import { dedupeHolidayRows } from "@/lib/hr/holiday-dedupe";
import type { SupabaseClient } from "@supabase/supabase-js";

export type HolidayOverrideType = "add" | "suppress" | "replace";

export interface HrHolidayOverrideRow {
  id: string;
  override_type: HolidayOverrideType;
  holiday_date: string;
  replaces_holiday_id: string | null;
  name: string | null;
  notes: string | null;
  created_at: string;
}

export interface EffectiveHolidayEntry {
  date: string;
  name: string;
  source: "imported" | "override_add" | "override_replace";
}

export interface EffectiveHolidayCalendar {
  nonWorkingDates: Set<string>;
  holidayByDate: Map<string, string>;
  entries: EffectiveHolidayEntry[];
}

interface BaseHolidayRow {
  id: string;
  holiday_date: string;
  name: string;
  state_code: string | null;
}

function holidayIdMap(rows: BaseHolidayRow[]): Map<string, BaseHolidayRow> {
  const map = new Map<string, BaseHolidayRow>();
  for (const row of rows) {
    map.set(row.id, row);
  }
  return map;
}

/**
 * Merge imported `hr_public_holidays` with per-business overrides.
 * Used by leave day counting and Operations booking checks.
 */
export function mergeEffectiveHolidayCalendar(
  baseHolidays: BaseHolidayRow[],
  overrides: HrHolidayOverrideRow[],
): EffectiveHolidayCalendar {
  const deduped = dedupeHolidayRows(baseHolidays);
  const byId = holidayIdMap(deduped);
  const byDate = new Map<string, { id: string; name: string }>();

  for (const row of deduped) {
    byDate.set(row.holiday_date, { id: row.id, name: row.name });
  }

  const suppress = overrides.filter((o) => o.override_type === "suppress");
  const replace = overrides.filter((o) => o.override_type === "replace");
  const add = overrides.filter((o) => o.override_type === "add");

  for (const row of suppress) {
    if (row.replaces_holiday_id) {
      const original = byId.get(row.replaces_holiday_id);
      if (original) {
        byDate.delete(original.holiday_date);
      }
    }
    byDate.delete(row.holiday_date);
  }

  for (const row of replace) {
    if (!row.replaces_holiday_id) continue;
    const original = byId.get(row.replaces_holiday_id);
    if (original) {
      byDate.delete(original.holiday_date);
    }
    const label =
      row.name?.trim() ||
      original?.name ||
      "Replacement holiday";
    byDate.set(row.holiday_date, {
      id: row.replaces_holiday_id,
      name: label,
    });
  }

  for (const row of add) {
    const label = row.name?.trim() || "Company closure";
    byDate.set(row.holiday_date, { id: row.id, name: label });
  }

  const entries: EffectiveHolidayEntry[] = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, meta]) => {
      const fromAdd = add.some((o) => o.holiday_date === date);
      const fromReplace = replace.some((o) => o.holiday_date === date);
      return {
        date,
        name: meta.name,
        source: fromAdd
          ? "override_add"
          : fromReplace
            ? "override_replace"
            : "imported",
      };
    });

  const holidayByDate = new Map<string, string>();
  for (const entry of entries) {
    holidayByDate.set(entry.date, entry.name);
  }

  return {
    nonWorkingDates: new Set(holidayByDate.keys()),
    holidayByDate,
    entries,
  };
}

export async function loadHrHolidayOverrides(
  supabase: SupabaseClient,
  businessId: string,
): Promise<HrHolidayOverrideRow[]> {
  const { data, error } = await supabase
    .from("business_holiday_overrides")
    .select(
      "id, override_type, holiday_date, replaces_holiday_id, name, notes, created_at",
    )
    .eq("business_id", businessId)
    .order("holiday_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as HrHolidayOverrideRow[];
}

export async function loadEffectiveHolidayCalendar(
  supabase: SupabaseClient,
  businessId: string,
): Promise<EffectiveHolidayCalendar> {
  const [holidaysRes, overrides] = await Promise.all([
    supabase
      .from("hr_public_holidays")
      .select("id, state_code, holiday_date, name")
      .or(`business_id.is.null,business_id.eq.${businessId}`),
    loadHrHolidayOverrides(supabase, businessId),
  ]);

  if (holidaysRes.error) throw new Error(holidaysRes.error.message);

  return mergeEffectiveHolidayCalendar(
    (holidaysRes.data ?? []) as BaseHolidayRow[],
    overrides,
  );
}

export async function loadEffectiveHolidayDateSet(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Set<string>> {
  const calendar = await loadEffectiveHolidayCalendar(supabase, businessId);
  return calendar.nonWorkingDates;
}
