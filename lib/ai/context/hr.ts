import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { HR_STAFF_APPRAISAL_ADDON_SLUG } from "@/lib/marketplace/agent-types";
import { appraisalDisplayStatus } from "@/lib/hr/appraisal";
import { dedupeHolidayRows } from "@/lib/hr/holiday-dedupe";
import { hasActiveAddonWithClient } from "@/lib/marketplace/entitlements";
import type { HrDocumentRow, HrEmployeeRow, HrLeaveRow } from "@/lib/hr/load";
import {
  buildCoverWarningLines,
  buildLeaveCalendarLines,
  buildProfileGapLines,
  formatLeaveBalanceLine,
} from "@/lib/ai/context/hr-enrichment";

import { createAgentScopedClient, verifyRows } from "./client";
import type {
  AgentContext,
  PillarSnapshot,
  SnapshotAttention,
  SnapshotItem,
} from "./types";

export interface HrSnapshotOptions {
  /** When omitted, checks the Staff Appraisal Checker marketplace add-on. */
  includeStaffAppraisals?: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentLeaveYear(): number {
  return new Date().getFullYear();
}

/**
 * HR overview snapshot — employees, leave, holidays, onboarding.
 * Strictly tenant-scoped via RLS + verifyRows.
 */
export async function buildHrSnapshot(
  ctx: AgentContext,
  client?: SupabaseClient,
  options?: HrSnapshotOptions,
): Promise<PillarSnapshot> {
  const supabase = client ?? (await createAgentScopedClient(ctx));
  const today = todayIso();
  const leaveYear = currentLeaveYear();

  let includeStaffAppraisals = options?.includeStaffAppraisals;
  if (includeStaffAppraisals === undefined) {
    includeStaffAppraisals = await hasActiveAddonWithClient(
      supabase,
      ctx.businessId,
      HR_STAFF_APPRAISAL_ADDON_SLUG,
    );
  }

  const employeesRes = await supabase
    .from("hr_employees")
    .select(
      "id, business_id, full_name, role_title, employment_type, status, start_date, " +
        "phone_e164, emergency_contact_name, bank_name, bank_account_no, bank_account_no_sealed, " +
        "annual_leave_entitlement_days",
    )
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(40);
  if (employeesRes.error) throw new Error(employeesRes.error.message);
  const employees = (employeesRes.data ?? []) as unknown as HrEmployeeRow[];

  const leaveRes = await supabase
    .from("hr_leave_records")
    .select(
      "id, business_id, employee_id, leave_type, start_date, end_date, status, hr_employees(full_name)",
    )
    .eq("business_id", ctx.businessId)
    .order("start_date", { ascending: false })
    .limit(40);
  const leave = verifyRows(leaveRes, ctx, "hr_leave_records") as unknown as HrLeaveRow[];

  const documentsRes = await supabase
    .from("hr_employee_documents")
    .select("id, business_id, employee_id, document_type, admin_file_id")
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null)
    .limit(120);
  if (documentsRes.error) throw new Error(documentsRes.error.message);
  const documents = (documentsRes.data ?? []) as unknown as HrDocumentRow[];

  const holidaysRes = await supabase
    .from("hr_public_holidays")
    .select("id, business_id, holiday_date, name, state_code")
    .or(`business_id.is.null,business_id.eq.${ctx.businessId}`)
    .gte("holiday_date", today)
    .order("holiday_date", { ascending: true })
    .limit(15);
  const holidaysRaw = verifyRows(holidaysRes, ctx, "hr_public_holidays");
  const holidays = dedupeHolidayRows([...holidaysRaw]);

  const onboardingRes = await supabase
    .from("hr_onboarding_items")
    .select("id, business_id, employee_id, label, is_done, hr_employees(full_name)")
    .eq("business_id", ctx.businessId)
    .eq("is_done", false)
    .limit(20);
  const onboarding = verifyRows(onboardingRes, ctx, "hr_onboarding_items");

  const pendingAppraisals = includeStaffAppraisals
    ? verifyRows(
        await supabase
          .from("hr_staff_appraisals")
          .select(
            "id, business_id, employee_id, period_label, due_date, status, hr_employees(full_name)",
          )
          .eq("business_id", ctx.businessId)
          .eq("status", "pending")
          .order("due_date", { ascending: true })
          .limit(15),
        ctx,
        "hr_staff_appraisals",
      )
    : [];

  const balanceRes = await supabase
    .from("hr_leave_balances")
    .select("employee_id, entitlement_days, taken_days, leave_year")
    .eq("business_id", ctx.businessId)
    .eq("leave_year", leaveYear);
  if (balanceRes.error) throw new Error(balanceRes.error.message);
  const balances = balanceRes.data ?? [];

  const activeEmployees = employees.filter((e) => e.status === "active");
  const activeCount = activeEmployees.length;
  const pendingLeave = leave.filter((l) => l.status === "pending");
  const onLeaveToday = leave.filter(
    (l) =>
      l.status === "approved" &&
      String(l.start_date) <= today &&
      String(l.end_date) >= today,
  );

  const balanceByEmployee = new Map(
    balances.map((b) => [
      String(b.employee_id),
      {
        entitlement: Number(b.entitlement_days),
        taken: Number(b.taken_days),
      },
    ]),
  );

  const balanceLines = activeEmployees
    .map((emp) => {
      const row = balanceByEmployee.get(emp.id);
      const entitlement = row?.entitlement ?? Number(emp.annual_leave_entitlement_days ?? 8);
      const taken = row?.taken ?? 0;
      const available = Math.max(0, entitlement - taken);
      return { emp, available, entitlement, taken };
    })
    .sort((a, b) => a.available - b.available)
    .slice(0, 6);

  const recent: SnapshotItem[] = [
    ...pendingLeave.slice(0, 3).map((row) => ({
      id: row.id as string,
      label: `Pending: ${row.hr_employees?.full_name ?? "Employee"}`,
      meta: `${String(row.leave_type).replace(/_/g, " ")} · ${row.start_date} to ${row.end_date} · id ${row.id}`,
      at: row.start_date as string,
    })),
    ...balanceLines.map(({ emp, available, entitlement, taken }) => ({
      id: `bal-${emp.id}`,
      label: formatLeaveBalanceLine(emp.full_name, available, entitlement, taken),
      meta: emp.role_title,
      at: null,
    })),
    ...onboarding.slice(0, 3).map((row) => ({
      id: row.id as string,
      label: `Onboarding: ${(row.hr_employees as { full_name?: string } | null)?.full_name ?? "Staff"}`,
      meta: String(row.label),
      at: null,
    })),
  ].slice(0, 12);

  const attention: SnapshotAttention[] = [];
  if (pendingLeave.length > 0) {
    attention.push({
      id: "pending_leave",
      label: `${pendingLeave.length} leave request(s) waiting for approval`,
      severity: "high",
    });
  }
  if (onboarding.length > 0) {
    attention.push({
      id: "onboarding_open",
      label: `${onboarding.length} open onboarding checklist item(s)`,
      severity: "medium",
    });
  }

  const profileGaps = buildProfileGapLines(activeEmployees, documents, 6);
  if (profileGaps.length > 0) {
    attention.push({
      id: "incomplete_profiles",
      label: `${profileGaps.length} staff with incomplete profiles (contact or documents)`,
      severity: "medium",
    });
  }

  const lowBalance = balanceLines.filter((b) => b.available <= 2 && b.entitlement > 0);
  if (lowBalance.length > 0) {
    attention.push({
      id: "low_al_balance",
      label: `${lowBalance.length} staff with 2 days or less annual leave left`,
      severity: "medium",
    });
  }

  const overdueAppraisals = pendingAppraisals.filter(
    (row) =>
      appraisalDisplayStatus(
        { status: String(row.status), due_date: String(row.due_date) },
        today,
      ) === "overdue",
  );
  if (overdueAppraisals.length > 0) {
    attention.push({
      id: "appraisals_overdue",
      label: `${overdueAppraisals.length} staff appraisal(s) overdue`,
      severity: "high",
    });
  } else if (pendingAppraisals.length > 0) {
    attention.push({
      id: "appraisals_pending",
      label: `${pendingAppraisals.length} staff appraisal(s) due`,
      severity: "medium",
    });
  }
  if (employees.length === 0) {
    attention.push({
      id: "no_employees",
      label: "No employee profiles yet — add staff to start HR records",
      severity: "medium",
    });
  }

  const noteLines = [
    onLeaveToday.length > 0
      ? `${onLeaveToday.length} staff on approved leave today.`
      : null,
    holidays[0]
      ? `Next holiday: ${holidays[0].name} on ${holidays[0].holiday_date}.`
      : null,
    profileGaps.length > 0
      ? `Profiles to finish: ${profileGaps.join(" | ")}`
      : null,
    ...buildCoverWarningLines(leave, today),
    "Leave calendar (14d):",
    ...buildLeaveCalendarLines(leave, today).map((l) => `  ${l}`),
  ].filter(Boolean) as string[];

  return {
    pillar: "hr",
    businessId: ctx.businessId,
    generatedAt: new Date().toISOString(),
    available: true,
    headline:
      `HR snapshot: ${employees.length} staff, ${pendingLeave.length} pending leave, ` +
      `${onLeaveToday.length} away today, ${lowBalance.length} low AL balance.`,
    kpis: [
      { key: "active_staff", label: "Active staff", value: activeCount },
      { key: "pending_leave", label: "Pending leave", value: pendingLeave.length },
      { key: "on_leave_today", label: "On leave today", value: onLeaveToday.length },
      {
        key: "open_onboarding",
        label: "Open onboarding items",
        value: onboarding.length,
      },
      {
        key: "upcoming_holidays",
        label: "Upcoming holidays",
        value: holidays.length,
      },
      ...(includeStaffAppraisals
        ? [
            {
              key: "pending_appraisals",
              label: "Pending appraisals",
              value: pendingAppraisals.length,
            },
          ]
        : []),
    ],
    recent,
    attention,
    notes: noteLines.length > 0 ? noteLines.join("\n") : undefined,
  };
}
