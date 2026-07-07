import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const WEEKEND_SAT = 6;
const WEEKEND_SUN = 0;

export function calendarYearFromIso(iso: string): number {
  return Number(iso.slice(0, 4));
}

/** Count Mon–Fri days in range, excluding dates in `holidayDates`. */
export function countWorkingLeaveDays(
  startDate: string,
  endDate: string,
  holidayDates: ReadonlySet<string>,
): number {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (end < start) return 0;

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getDay();
    const iso = cursor.toISOString().slice(0, 10);
    if (dow !== WEEKEND_SAT && dow !== WEEKEND_SUN && !holidayDates.has(iso)) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export interface LeaveBalanceSnapshot {
  leaveYear: number;
  entitlementDays: number;
  takenDays: number;
  availableDays: number;
  pendingDays?: number;
}

export async function loadHolidayDateSet(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("hr_public_holidays")
    .select("holiday_date")
    .or(`business_id.is.null,business_id.eq.${businessId}`);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => String(row.holiday_date)));
}

export async function getOrCreateLeaveBalance(
  supabase: SupabaseClient,
  businessId: string,
  employeeId: string,
  leaveYear: number,
  entitlementDays: number,
): Promise<{ takenDays: number; entitlementDays: number }> {
  const { data: existing } = await supabase
    .from("hr_leave_balances")
    .select("id, taken_days, entitlement_days")
    .eq("business_id", businessId)
    .eq("employee_id", employeeId)
    .eq("leave_year", leaveYear)
    .maybeSingle();

  if (existing) {
    return {
      takenDays: Number(existing.taken_days),
      entitlementDays: Number(existing.entitlement_days),
    };
  }

  const { data: created, error } = await supabase
    .from("hr_leave_balances")
    .insert({
      business_id: businessId,
      employee_id: employeeId,
      leave_year: leaveYear,
      entitlement_days: entitlementDays,
      taken_days: 0,
    })
    .select("taken_days, entitlement_days")
    .single();

  if (error) throw new Error(error.message);
  return {
    takenDays: Number(created.taken_days),
    entitlementDays: Number(created.entitlement_days),
  };
}

export async function loadEmployeeLeaveBalance(
  supabase: SupabaseClient,
  businessId: string,
  employeeId: string,
  entitlementDays: number,
  leaveYear: number = new Date().getFullYear(),
): Promise<LeaveBalanceSnapshot> {
  const row = await getOrCreateLeaveBalance(
    supabase,
    businessId,
    employeeId,
    leaveYear,
    entitlementDays,
  );
  return {
    leaveYear,
    entitlementDays: row.entitlementDays,
    takenDays: row.takenDays,
    availableDays: Math.max(0, row.entitlementDays - row.takenDays),
  };
}

export interface BalanceWarning {
  code: "al_over_balance";
  message: string;
  requestedDays: number;
  availableDays: number;
  takenAfter: number;
  entitlementDays: number;
}

export function buildOverBalanceWarning(
  entitlementDays: number,
  takenDays: number,
  requestedDays: number,
): BalanceWarning | null {
  const available = Math.max(0, entitlementDays - takenDays);
  const takenAfter = takenDays + requestedDays;
  if (takenAfter <= entitlementDays) return null;
  return {
    code: "al_over_balance",
    message: `This approval uses ${requestedDays} working day(s) but only ${available} day(s) remain (${takenDays} of ${entitlementDays} used). You can still approve.`,
    requestedDays,
    availableDays: available,
    takenAfter,
    entitlementDays,
  };
}

export async function applyAnnualLeaveApproval(
  supabase: SupabaseClient,
  args: {
    businessId: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    entitlementDays: number;
  },
): Promise<{ days: number; warning: BalanceWarning | null }> {
  const holidays = await loadHolidayDateSet(supabase, args.businessId);
  const days = countWorkingLeaveDays(args.startDate, args.endDate, holidays);
  const leaveYear = calendarYearFromIso(args.startDate);

  const balance = await getOrCreateLeaveBalance(
    supabase,
    args.businessId,
    args.employeeId,
    leaveYear,
    args.entitlementDays,
  );

  const warning = buildOverBalanceWarning(
    balance.entitlementDays,
    balance.takenDays,
    days,
  );

  const { error } = await supabase
    .from("hr_leave_balances")
    .update({ taken_days: balance.takenDays + days })
    .eq("business_id", args.businessId)
    .eq("employee_id", args.employeeId)
    .eq("leave_year", leaveYear);

  if (error) throw new Error(error.message);

  return { days, warning };
}
