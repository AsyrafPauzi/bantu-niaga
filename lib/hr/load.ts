import { EMPLOYEE_DETAIL_SELECT, EMPLOYEE_LIST_SELECT } from "@/lib/hr/employee-fields";
import { mapEmployeeDetailRow, mapEmployeeListRow } from "@/lib/hr/employee-api";
import { addDaysYmd, selectExpiringContracts } from "@/lib/hr/desk";
import { loadEmployeeLeaveBalance } from "@/lib/hr/leave-balance";
import { isEmployeeProfileIncomplete } from "@/lib/hr/profile-completion";
import { dedupeHolidayRows } from "@/lib/hr/holiday-dedupe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPillarNotifications, type PillarNotificationItem } from "@/lib/notifications/load-pillar";

export interface HrEmployeeLeaveBalance {
  leaveYear: number;
  entitlementDays: number;
  takenDays: number;
  availableDays: number;
}

export interface HrEmployeeRow {
  id: string;
  full_name: string;
  employee_number: string | null;
  employment_type: string;
  role_title: string;
  start_date: string;
  contract_end_date: string | null;
  status: string;
  phone_e164: string | null;
  email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_no_sealed?: unknown | null;
  bank_account_holder: string | null;
  notes: string | null;
  annual_leave_entitlement_days?: number;
  leave_entitlements?: Record<string, number>;
  base_salary_myr: number | null;
  created_at: string;
}

export interface HrLeaveRow {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  decision_note: string | null;
  created_at: string;
  mc_document_path?: string | null;
  mc_document_name?: string | null;
  mc_document_mime?: string | null;
  hr_employees?: {
    full_name: string;
    role_title: string;
    phone_e164?: string | null;
  } | null;
}

export interface HrOnboardingRow {
  id: string;
  employee_id: string;
  label: string;
  is_done: boolean;
  hr_employees?: { full_name: string } | null;
}

export interface HrStaffAppraisalRow {
  id: string;
  employee_id: string;
  period_label: string;
  due_date: string;
  status: string;
  rating: number | null;
  notes: string | null;
  completed_at: string | null;
  hr_employees?: { full_name: string; role_title: string } | null;
}

export interface HrDocumentRow {
  id: string;
  employee_id: string;
  document_type: string;
  label: string;
  admin_file_id: string | null;
  created_at: string;
  hr_employees?: { full_name: string } | null;
  admin_files?: { file_name: string; category: string | null } | null;
}

export interface HrHolidayRow {
  id: string;
  state_code: string | null;
  holiday_date: string;
  name: string;
}

export interface HrNotificationItem extends PillarNotificationItem {}

export interface HrDashboardData {
  employees: HrEmployeeRow[];
  leavePending: HrLeaveRow[];
  leaveOnToday: HrLeaveRow[];
  leaveThisWeek: HrLeaveRow[];
  leaveRecentApproved: HrLeaveRow[];
  onboarding: HrOnboardingRow[];
  documents: HrDocumentRow[];
  expiringContracts: Array<{
    id: string;
    full_name: string;
    role_title: string;
    contract_end_date: string;
  }>;
  holidays: HrHolidayRow[];
  notifications: HrNotificationItem[];
  counts: {
    activeEmployees: number;
    totalEmployees: number;
    leaveToday: number;
    leaveThisWeek: number;
    pendingLeave: number;
    approvedThisMonth: number;
    documentCount: number;
    incompleteOnboarding: number;
    onboardingTotal: number;
    onboardingDone: number;
    incompleteProfiles: number;
    expiringContracts: number;
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function loadHrEmployee(
  businessId: string,
  employeeId: string,
): Promise<(HrEmployeeRow & {
  identity_type?: string | null;
  identity_number?: string | null;
  identity_number_masked?: string | null;
  bank_account_no_masked?: string | null;
}) | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_employees")
    .select(EMPLOYEE_DETAIL_SELECT)
    .eq("business_id", businessId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapEmployeeDetailRow(data as unknown as Record<string, unknown>);
}

export async function loadHrEmployeeLeaveBalanceSummary(
  businessId: string,
  employeeId: string,
  entitlementDays: number,
): Promise<HrEmployeeLeaveBalance> {
  const supabase = await createSupabaseServerClient();
  return loadEmployeeLeaveBalance(
    supabase,
    businessId,
    employeeId,
    entitlementDays,
  );
}

export async function loadHrEmployees(
  businessId: string,
): Promise<HrEmployeeRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_employees")
    .select(EMPLOYEE_LIST_SELECT)
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    mapEmployeeListRow(row as unknown as Record<string, unknown>),
  );
}

const HR_LEAVE_SELECT =
  "id, employee_id, leave_type, start_date, end_date, reason, status, decision_note, created_at, " +
  "mc_document_path, mc_document_name, mc_document_mime, " +
  "hr_employees(full_name, role_title)";

export async function loadHrLeaveRecords(
  businessId: string,
): Promise<HrLeaveRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_leave_records")
    .select(HR_LEAVE_SELECT)
    .eq("business_id", businessId)
    .order("start_date", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HrLeaveRow[];
}

function monthRangeIso(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

/** Leave overlapping a calendar month (approved or pending). */
export async function loadHrLeaveRecordsForMonth(
  businessId: string,
  year: number,
  month: number,
): Promise<HrLeaveRow[]> {
  const supabase = await createSupabaseServerClient();
  const { start, end } = monthRangeIso(year, month);
  const { data, error } = await supabase
    .from("hr_leave_records")
    .select(HR_LEAVE_SELECT)
    .eq("business_id", businessId)
    .in("status", ["approved", "pending"])
    .lte("start_date", end)
    .gte("end_date", start)
    .order("start_date", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HrLeaveRow[];
}

export async function loadStaffMeLeaveRecords(
  businessId: string,
  employeeId: string,
): Promise<HrLeaveRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_leave_records")
    .select(
      "id, employee_id, leave_type, start_date, end_date, reason, status, decision_note, created_at, " +
        "mc_document_path, mc_document_name, mc_document_mime",
    )
    .eq("business_id", businessId)
    .eq("employee_id", employeeId)
    .order("start_date", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HrLeaveRow[];
}

export async function loadStaffMeLeaveRecord(
  businessId: string,
  employeeId: string,
  leaveId: string,
): Promise<HrLeaveRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_leave_records")
    .select(
      "id, employee_id, leave_type, start_date, end_date, reason, status, decision_note, created_at, " +
        "mc_document_path, mc_document_name, mc_document_mime",
    )
    .eq("business_id", businessId)
    .eq("employee_id", employeeId)
    .eq("id", leaveId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as unknown as HrLeaveRow | null;
}

export async function loadStaffMeOnboardingItems(
  businessId: string,
  employeeId: string,
): Promise<HrOnboardingRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_onboarding_items")
    .select("id, employee_id, label, is_done")
    .eq("business_id", businessId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HrOnboardingRow[];
}

export async function loadHrDocuments(
  businessId: string,
): Promise<HrDocumentRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_employee_documents")
    .select(
      "id, employee_id, document_type, label, admin_file_id, created_at, " +
        "hr_employees(full_name), admin_files(file_name, category)",
    )
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HrDocumentRow[];
}

export async function loadHrOnboardingItems(
  businessId: string,
): Promise<HrOnboardingRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_onboarding_items")
    .select("id, employee_id, label, is_done, hr_employees(full_name)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HrOnboardingRow[];
}

export async function loadHrStaffAppraisals(
  businessId: string,
): Promise<HrStaffAppraisalRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_staff_appraisals")
    .select(
      "id, employee_id, period_label, due_date, status, rating, notes, completed_at, " +
        "hr_employees(full_name, role_title)",
    )
    .eq("business_id", businessId)
    .order("due_date", { ascending: true })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HrStaffAppraisalRow[];
}

export async function loadHrPublicHolidays(
  businessId: string,
): Promise<HrHolidayRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_public_holidays")
    .select("id, state_code, holiday_date, name")
    .or(`business_id.is.null,business_id.eq.${businessId}`)
    .order("holiday_date", { ascending: true })
    .limit(100);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as HrHolidayRow[];
  return dedupeHolidayRows(rows);
}

const LEAVE_DASHBOARD_SELECT =
  "id, employee_id, leave_type, start_date, end_date, reason, status, decision_note, created_at, " +
  "mc_document_path, mc_document_name, mc_document_mime, " +
  "hr_employees(full_name, role_title, phone_e164)";

export async function loadHrDashboard(
  businessId: string,
): Promise<HrDashboardData> {
  const supabase = await createSupabaseServerClient();
  const today = todayIso();
  const weekEnd = addDaysYmd(today, 6);
  const monthPrefix = today.slice(0, 7);

  const [
    employees,
    pendingResult,
    onLeaveResult,
    weekLeaveResult,
    recentApprovedResult,
    approvedMonthResult,
    onboardingResult,
    documents,
    holidays,
    notifications,
  ] = await Promise.all([
    loadHrEmployees(businessId),
    supabase
      .from("hr_leave_records")
      .select(LEAVE_DASHBOARD_SELECT)
      .eq("business_id", businessId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("hr_leave_records")
      .select(LEAVE_DASHBOARD_SELECT)
      .eq("business_id", businessId)
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today)
      .order("start_date", { ascending: true }),
    supabase
      .from("hr_leave_records")
      .select(LEAVE_DASHBOARD_SELECT)
      .eq("business_id", businessId)
      .eq("status", "approved")
      .lte("start_date", weekEnd)
      .gte("end_date", today)
      .order("start_date", { ascending: true })
      .limit(50),
    supabase
      .from("hr_leave_records")
      .select(LEAVE_DASHBOARD_SELECT)
      .eq("business_id", businessId)
      .eq("status", "approved")
      .order("start_date", { ascending: false })
      .limit(5),
    supabase
      .from("hr_leave_records")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "approved")
      .gte("start_date", `${monthPrefix}-01`)
      .lte("start_date", `${monthPrefix}-31`),
    supabase
      .from("hr_onboarding_items")
      .select("id, employee_id, label, is_done, hr_employees(full_name)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(100),
    loadHrDocuments(businessId),
    loadHrPublicHolidays(businessId),
    loadPillarNotifications(supabase, businessId, "hr", 12),
  ]);

  if (pendingResult.error) throw new Error(pendingResult.error.message);
  if (onLeaveResult.error) throw new Error(onLeaveResult.error.message);
  if (weekLeaveResult.error) throw new Error(weekLeaveResult.error.message);
  if (recentApprovedResult.error) throw new Error(recentApprovedResult.error.message);
  if (onboardingResult.error) throw new Error(onboardingResult.error.message);

  const leavePending = (pendingResult.data ?? []) as unknown as HrLeaveRow[];
  const leaveOnToday = (onLeaveResult.data ?? []) as unknown as HrLeaveRow[];
  const leaveThisWeek = (weekLeaveResult.data ?? []) as unknown as HrLeaveRow[];
  const leaveRecentApproved = (recentApprovedResult.data ?? []) as unknown as HrLeaveRow[];
  const onboarding = (onboardingResult.data ?? []) as unknown as HrOnboardingRow[];
  const onboardingDone = onboarding.filter((row) => row.is_done).length;
  const onboardingOpen = onboarding.length - onboardingDone;

  const incompleteProfiles = employees.filter((emp) =>
    isEmployeeProfileIncomplete(emp, documents),
  ).length;

  const expiringContracts = selectExpiringContracts(employees, today, 30).map(
    (emp) => ({
      id: emp.id,
      full_name: emp.full_name,
      role_title: emp.role_title,
      contract_end_date: emp.contract_end_date as string,
    }),
  );

  return {
    employees,
    leavePending,
    leaveOnToday,
    leaveThisWeek,
    leaveRecentApproved,
    onboarding: onboarding.filter((row) => !row.is_done).slice(0, 8),
    documents,
    expiringContracts,
    holidays,
    notifications,
    counts: {
      activeEmployees: employees.filter((row) => row.status === "active").length,
      totalEmployees: employees.length,
      leaveToday: leaveOnToday.length,
      leaveThisWeek: leaveThisWeek.length,
      pendingLeave: leavePending.length,
      approvedThisMonth: approvedMonthResult.count ?? 0,
      documentCount: documents.length,
      incompleteOnboarding: onboardingOpen,
      onboardingTotal: onboarding.length,
      onboardingDone,
      incompleteProfiles,
      expiringContracts: expiringContracts.length,
    },
  };
}

export interface HrDailyNoticeRow {
  id: string;
  title: string;
  body: string;
  notice_date: string;
}

export async function loadTodayHrNotice(
  businessId: string,
): Promise<HrDailyNoticeRow | null> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("agent_daily_notices")
    .select("id, title, body, notice_date")
    .eq("business_id", businessId)
    .eq("agent_slug", "hr")
    .eq("notice_date", today)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as HrDailyNoticeRow | null) ?? null;
}
