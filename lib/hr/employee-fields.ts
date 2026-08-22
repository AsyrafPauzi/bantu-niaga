export const EMPLOYEE_LIST_SELECT =
  "id, user_id, full_name, employee_number, employment_type, role_title, start_date, contract_end_date, " +
  "status, phone_e164, email, emergency_contact_name, emergency_contact_relationship, " +
  "emergency_contact_phone, bank_name, bank_account_holder, bank_account_no_sealed, notes, " +
  "annual_leave_entitlement_days, leave_entitlements, base_salary_myr, created_at";

export const EMPLOYEE_DETAIL_SELECT =
  EMPLOYEE_LIST_SELECT +
  ", identity_type, identity_number, bank_account_no, " +
  "identity_number_sealed, bank_account_no_sealed";

export const DEFAULT_ONBOARDING_LABELS = [
  "IC / passport collected",
  "Bank details collected",
  "Employment contract signed",
  "Uniform / equipment issued",
  "SOP briefing completed",
] as const;
