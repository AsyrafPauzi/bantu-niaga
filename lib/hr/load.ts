import { EMPLOYEE_DETAIL_SELECT, EMPLOYEE_LIST_SELECT } from "@/lib/hr/employee-fields";
import { mapEmployeeDetailRow, mapEmployeeListRow } from "@/lib/hr/employee-api";
import { loadEmployeeLeaveBalance } from "@/lib/hr/leave-balance";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface HrEmployeeLeaveBalance {
  leaveYear: number;
  entitlementDays: number;
  takenDays: number;
  availableDays: number;
}

export interface HrEmployeeRow {
  id: string;
  full_name: string;
  employment_type: string;
  role_title: string;
  start_date: string;
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
  hr_employees?: { full_name: string; role_title: string } | null;
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

export interface HrDashboardData {
  employees: HrEmployeeRow[];
  leave: HrLeaveRow[];
  onboarding: HrOnboardingRow[];
  documents: HrDocumentRow[];
  holidays: HrHolidayRow[];
  counts: {
    activeEmployees: number;
    leaveToday: number;
    pendingLeave: number;
    incompleteOnboarding: number;
    onboardingTotal: number;
    onboardingDone: number;
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

export async function loadHrLeaveRecords(
  businessId: string,
): Promise<HrLeaveRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_leave_records")
    .select(
      "id, employee_id, leave_type, start_date, end_date, reason, status, decision_note, created_at, " +
        "mc_document_path, mc_document_name, mc_document_mime, " +
        "hr_employees(full_name, role_title)",
    )
    .eq("business_id", businessId)
    .order("start_date", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HrLeaveRow[];
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
  return (data ?? []) as unknown as HrHolidayRow[];
}

export async function loadHrDashboard(
  businessId: string,
): Promise<HrDashboardData> {
  const supabase = await createSupabaseServerClient();
  const [employees, leaveResult, onboardingResult, documents, holidays] =
    await Promise.all([
    loadHrEmployees(businessId),
    supabase
      .from("hr_leave_records")
      .select(
        "id, employee_id, leave_type, start_date, end_date, reason, status, decision_note, created_at, " +
          "mc_document_path, mc_document_name, mc_document_mime, " +
          "hr_employees(full_name, role_title)",
      )
      .eq("business_id", businessId)
      .order("start_date", { ascending: true })
      .limit(10),
    supabase
      .from("hr_onboarding_items")
      .select("id, employee_id, label, is_done, hr_employees(full_name)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(100),
    loadHrDocuments(businessId),
    loadHrPublicHolidays(businessId),
  ]);

  if (leaveResult.error) throw new Error(leaveResult.error.message);
  if (onboardingResult.error) throw new Error(onboardingResult.error.message);

  const today = todayIso();
  const leave = (leaveResult.data ?? []) as unknown as HrLeaveRow[];
  const onboarding = (onboardingResult.data ?? []) as unknown as HrOnboardingRow[];
  const onboardingDone = onboarding.filter((row) => row.is_done).length;
  const onboardingOpen = onboarding.length - onboardingDone;

  return {
    employees,
    leave,
    onboarding: onboarding.filter((row) => !row.is_done).slice(0, 10),
    documents,
    holidays,
    counts: {
      activeEmployees: employees.filter((row) => row.status === "active").length,
      leaveToday: leave.filter(
        (row) =>
          row.status === "approved" &&
          row.start_date <= today &&
          row.end_date >= today,
      ).length,
      pendingLeave: leave.filter((row) => row.status === "pending").length,
      incompleteOnboarding: onboardingOpen,
      onboardingTotal: onboarding.length,
      onboardingDone,
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
