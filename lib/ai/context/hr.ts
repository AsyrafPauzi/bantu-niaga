import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { HR_PUBLIC_HOLIDAYS_ADDON_SLUG, HR_STAFF_APPRAISAL_ADDON_SLUG } from "@/lib/marketplace/agent-types";
import { appraisalDisplayStatus } from "@/lib/hr/appraisal";
import { hasActiveAddonWithClient } from "@/lib/marketplace/entitlements";

import { createAgentScopedClient, verifyRows } from "./client";
import type {
  AgentContext,
  PillarSnapshot,
  SnapshotAttention,
  SnapshotItem,
} from "./types";

export interface HrSnapshotOptions {
  /** When omitted, checks the Public Holiday Calendar marketplace add-on. */
  includePublicHolidays?: boolean;
  /** When omitted, checks the Staff Appraisal Checker marketplace add-on. */
  includeStaffAppraisals?: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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

  let includePublicHolidays = options?.includePublicHolidays;
  if (includePublicHolidays === undefined) {
    includePublicHolidays = await hasActiveAddonWithClient(
      supabase,
      ctx.businessId,
      HR_PUBLIC_HOLIDAYS_ADDON_SLUG,
    );
  }

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
    .select("id, business_id, full_name, role_title, employment_type, status, start_date")
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(40);
  const employees = verifyRows(employeesRes, ctx, "hr_employees");

  const leaveRes = await supabase
    .from("hr_leave_records")
    .select(
      "id, business_id, employee_id, leave_type, start_date, end_date, status, hr_employees(full_name)",
    )
    .eq("business_id", ctx.businessId)
    .order("start_date", { ascending: false })
    .limit(30);
  const leave = verifyRows(leaveRes, ctx, "hr_leave_records");

  const holidays = includePublicHolidays
    ? verifyRows(
        await supabase
          .from("hr_public_holidays")
          .select("id, business_id, holiday_date, name, state_code")
          .or(`business_id.is.null,business_id.eq.${ctx.businessId}`)
          .gte("holiday_date", today)
          .order("holiday_date", { ascending: true })
          .limit(10),
        ctx,
        "hr_public_holidays",
      )
    : [];

  const onboardingRes = await supabase
    .from("hr_onboarding_items")
    .select("id, business_id, employee_id, label, is_done, hr_employees(full_name)")
    .eq("business_id", ctx.businessId)
    .eq("is_done", false)
    .limit(15);
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

  const activeCount = employees.filter((e) => e.status === "active").length;
  const pendingLeave = leave.filter((l) => l.status === "pending");
  const onLeaveToday = leave.filter(
    (l) =>
      l.status === "approved" &&
      String(l.start_date) <= today &&
      String(l.end_date) >= today,
  );
  const recent: SnapshotItem[] = [
    ...pendingLeave.slice(0, 4).map((row) => ({
      id: row.id as string,
      label: `Pending leave: ${(row.hr_employees as { full_name?: string } | null)?.full_name ?? "Employee"}`,
      meta: `${String(row.leave_type).replace(/_/g, " ")} · ${row.start_date} to ${row.end_date}`,
      at: row.start_date as string,
    })),
    ...employees.slice(0, 4).map((row) => ({
      id: row.id as string,
      label: row.full_name as string,
      meta: `${row.role_title} · ${String(row.employment_type).replace(/_/g, " ")} · ${row.status}`,
      at: row.start_date as string,
    })),
  ].slice(0, 10);

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

  const nextHoliday = holidays[0];
  const notes = [
    onLeaveToday.length > 0
      ? `${onLeaveToday.length} staff on approved leave today.`
      : null,
    nextHoliday
      ? `Next holiday: ${nextHoliday.name} on ${nextHoliday.holiday_date}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    pillar: "hr",
    businessId: ctx.businessId,
    generatedAt: new Date().toISOString(),
    available: true,
    headline:
      `HR snapshot for this business: ${employees.length} staff profile(s), ` +
      `${pendingLeave.length} pending leave, ${onLeaveToday.length} on leave today.`,
    kpis: [
      { key: "active_staff", label: "Active staff", value: activeCount },
      { key: "pending_leave", label: "Pending leave", value: pendingLeave.length },
      { key: "on_leave_today", label: "On leave today", value: onLeaveToday.length },
      {
        key: "open_onboarding",
        label: "Open onboarding items",
        value: onboarding.length,
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
      ...(includePublicHolidays
        ? [
            {
              key: "upcoming_holidays",
              label: "Upcoming holidays",
              value: holidays.length,
            },
          ]
        : []),
    ],
    recent,
    attention,
    notes: notes || undefined,
  };
}
