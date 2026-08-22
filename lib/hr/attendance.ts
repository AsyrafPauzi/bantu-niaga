import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface HrClockEventRow {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  source: string;
  notes: string | null;
  created_at: string;
  hr_employees?: { full_name: string; role_title: string } | null;
}

const CLOCK_EVENT_SELECT =
  "id, employee_id, clock_in, clock_out, source, notes, created_at, hr_employees(full_name, role_title)";

export class ClockEventConflictError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export async function loadHrClockEvents(
  businessId: string,
  options?: { employeeId?: string; limit?: number },
): Promise<HrClockEventRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("hr_clock_events")
    .select(CLOCK_EVENT_SELECT)
    .eq("business_id", businessId)
    .order("clock_in", { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.employeeId) {
    query = query.eq("employee_id", options.employeeId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HrClockEventRow[];
}

export type HrClockShiftFilter = "all" | "open" | "closed";

export async function loadHrClockEventsPage(
  businessId: string,
  options: {
    employeeId: string;
    shift?: HrClockShiftFilter;
    from: number;
    to: number;
  },
): Promise<{ rows: HrClockEventRow[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("hr_clock_events")
    .select(CLOCK_EVENT_SELECT, { count: "exact" })
    .eq("business_id", businessId)
    .eq("employee_id", options.employeeId)
    .order("clock_in", { ascending: false })
    .range(options.from, options.to);

  if (options.shift === "open") {
    query = query.is("clock_out", null);
  } else if (options.shift === "closed") {
    query = query.not("clock_out", "is", null);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    rows: (data ?? []) as unknown as HrClockEventRow[],
    total: count ?? data?.length ?? 0,
  };
}

export async function loadOpenClockEvents(
  businessId: string,
): Promise<HrClockEventRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_clock_events")
    .select(CLOCK_EVENT_SELECT)
    .eq("business_id", businessId)
    .is("clock_out", null)
    .order("clock_in", { ascending: true })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HrClockEventRow[];
}

export async function loadOpenClockEvent(
  admin: SupabaseClient,
  businessId: string,
  employeeId: string,
): Promise<HrClockEventRow | null> {
  const { data, error } = await admin
    .from("hr_clock_events")
    .select(CLOCK_EVENT_SELECT)
    .eq("business_id", businessId)
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as unknown as HrClockEventRow;
}

export async function clockInEmployee(
  admin: SupabaseClient,
  input: {
    businessId: string;
    employeeId: string;
    source: "manual" | "self" | "manager";
    notes?: string | null;
    createdBy?: string | null;
    clockIn?: string;
  },
): Promise<HrClockEventRow> {
  const open = await loadOpenClockEvent(admin, input.businessId, input.employeeId);
  if (open) {
    throw new ClockEventConflictError("already_clocked_in");
  }

  const { data, error } = await admin
    .from("hr_clock_events")
    .insert({
      business_id: input.businessId,
      employee_id: input.employeeId,
      clock_in: input.clockIn ?? new Date().toISOString(),
      source: input.source,
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(CLOCK_EVENT_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as HrClockEventRow;
}

export async function clockOutEmployee(
  admin: SupabaseClient,
  input: {
    businessId: string;
    eventId: string;
    clockOut?: string;
    notes?: string | null;
  },
): Promise<HrClockEventRow> {
  const patch: Record<string, unknown> = {
    clock_out: input.clockOut ?? new Date().toISOString(),
  };
  if (input.notes !== undefined) {
    patch.notes = input.notes;
  }

  const { data, error } = await admin
    .from("hr_clock_events")
    .update(patch)
    .eq("business_id", input.businessId)
    .eq("id", input.eventId)
    .is("clock_out", null)
    .select(CLOCK_EVENT_SELECT)
    .single();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new ClockEventConflictError("not_found_or_closed");
  }
  return data as unknown as HrClockEventRow;
}
