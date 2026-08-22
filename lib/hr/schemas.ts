import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format");

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalText = (max: number) =>
  z.preprocess(
    emptyToNull,
    z.string().trim().min(1).max(max).nullable().optional(),
  );

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "intern",
] as const;

export const EMPLOYEE_STATUSES = ["active", "inactive", "terminated"] as const;

/** Common emergency contact relationships for HR forms. */
export const EMERGENCY_CONTACT_RELATIONSHIPS = [
  "Father",
  "Mother",
  "Spouse",
  "Sibling",
  "Child",
  "Relative",
  "Friend",
  "Other",
] as const;

/** Common Malaysian banks for payroll forms. */
export const MALAYSIAN_BANKS = [
  "Maybank",
  "CIMB Bank",
  "Public Bank",
  "RHB Bank",
  "Hong Leong Bank",
  "AmBank",
  "Bank Islam",
  "BSN",
  "Bank Rakyat",
  "Affin Bank",
  "Alliance Bank",
  "OCBC Bank",
  "Standard Chartered",
  "HSBC",
  "UOB",
  "Agrobank",
  "Other",
] as const;

export const LEAVE_TYPES = [
  "annual",
  "emergency",
  "mc",
  "hospitalisation",
  "unpaid",
] as const;

/** Leave types that require an uploaded supporting document (MC, emergency proof, etc.). */
export const LEAVE_TYPES_REQUIRING_DOCUMENT = [
  "mc",
  "emergency",
  "hospitalisation",
] as const;

export function leaveTypeRequiresDocument(
  leaveType: string,
): leaveType is typeof LEAVE_TYPES_REQUIRING_DOCUMENT[number] {
  return (LEAVE_TYPES_REQUIRING_DOCUMENT as readonly string[]).includes(
    leaveType,
  );
}

export const LEAVE_STATUSES = ["pending", "approved", "rejected"] as const;

export const DOCUMENT_TYPES = [
  "ic",
  "passport",
  "bank",
  "medical",
  "contract",
  "other",
] as const;

const optionalSalaryMyr = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined ? null : value,
  z.coerce.number().min(0).max(99999999.99).nullable().optional(),
);

const leaveEntitlementDays = z.coerce.number().min(0).max(365).optional();

export const employeeLeaveEntitlementsSchema = z
  .object({
    mc: leaveEntitlementDays,
    emergency: leaveEntitlementDays,
    hospitalisation: leaveEntitlementDays,
  })
  .partial()
  .optional();

export const employeeCreateSchema = z
  .object({
    full_name: z.string().trim().min(1).max(160),
    employee_number: optionalText(40),
    employment_type: z.enum(EMPLOYMENT_TYPES),
    role_title: z.string().trim().min(1).max(120),
    start_date: isoDate,
    contract_end_date: z.preprocess(emptyToNull, isoDate.nullable().optional()),
    status: z.enum(EMPLOYEE_STATUSES).default("active"),
    identity_type: z.preprocess(
      emptyToNull,
      z.enum(["ic", "passport"]).nullable().optional(),
    ),
    identity_number: optionalText(80),
    phone_e164: optionalText(24),
    email: z.preprocess(
      emptyToNull,
      z.string().trim().email().max(160).nullable().optional(),
    ),
    emergency_contact_name: optionalText(160),
    emergency_contact_relationship: optionalText(80),
    emergency_contact_phone: optionalText(24),
    bank_name: optionalText(120),
    bank_account_no: optionalText(80),
    bank_account_holder: optionalText(160),
    notes: optionalText(1000),
    annual_leave_entitlement_days: z.coerce.number().min(0).max(365).optional(),
    leave_entitlements: employeeLeaveEntitlementsSchema,
    base_salary_myr: optionalSalaryMyr,
    apply_default_onboarding: z.boolean().optional(),
  })
  .strict();

export const employeeUpdateSchema = employeeCreateSchema
  .partial()
  .extend({
    /** Link / unlink Settings → Team login for /hr/me self-service. */
    user_id: z.preprocess(
      emptyToNull,
      z.string().uuid().nullable().optional(),
    ),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one employee field is required",
  );

const leaveDateFields = {
  leave_type: z.enum(LEAVE_TYPES),
  start_date: isoDate,
  end_date: isoDate,
  reason: optionalText(500),
};

export const publicLeaveCreateSchema = z
  .object(leaveDateFields)
  .strict()
  .refine((value) => value.end_date >= value.start_date, {
    message: "End date cannot be before start date",
    path: ["end_date"],
  });

export const leaveCreateSchema = z
  .object({
    employee_id: z.string().uuid(),
    ...leaveDateFields,
  })
  .strict()
  .refine((value) => value.end_date >= value.start_date, {
    message: "End date cannot be before start date",
    path: ["end_date"],
  });

export const leaveStatusUpdateSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    decision_note: optionalText(500),
    acknowledge_booking_conflicts: z.boolean().optional(),
  })
  .strict();

export const leaveUpdateSchema = z
  .object({
    leave_type: z.enum(LEAVE_TYPES).optional(),
    start_date: isoDate.optional(),
    end_date: isoDate.optional(),
    reason: optionalText(500),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  })
  .refine(
    (value) => {
      if (value.start_date && value.end_date) {
        return value.end_date >= value.start_date;
      }
      return true;
    },
    { message: "End date cannot be before start date", path: ["end_date"] },
  );

export const leaveTypeSettingsUpdateSchema = z
  .object({
    settings: z.array(
      z.object({
        leave_type: z.enum(LEAVE_TYPES),
        default_quota_days: z
          .union([z.coerce.number().min(0).max(365), z.null()])
          .optional(),
        attachment_required: z.boolean().optional(),
        enabled: z.boolean().optional(),
      }),
    ),
  })
  .strict();

export const employeeDocumentCreateSchema = z
  .object({
    employee_id: z.string().uuid(),
    admin_file_id: z.preprocess(
      emptyToNull,
      z.string().uuid().nullable().optional(),
    ),
    document_type: z.enum(DOCUMENT_TYPES),
    label: z.string().trim().min(1).max(160),
  })
  .strict();

export const onboardingCreateSchema = z
  .object({
    employee_id: z.string().uuid(),
    label: z.string().trim().min(1).max(160),
  })
  .strict();

export const onboardingStatusUpdateSchema = z
  .object({
    is_done: z.boolean(),
  })
  .strict();

export const appraisalCreateSchema = z
  .object({
    employee_id: z.string().uuid(),
    period_label: z.string().trim().min(1).max(80),
    due_date: isoDate,
    notes: optionalText(1000),
  })
  .strict();

export const appraisalUpdateSchema = z
  .object({
    status: z.enum(["pending", "completed"]).optional(),
    rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
    notes: optionalText(1000),
    due_date: isoDate.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const holidayCreateSchema = z
  .object({
    state_code: optionalText(12),
    holiday_date: isoDate,
    name: z.string().trim().min(1).max(160),
  })
  .strict();

export const holidayOverrideCreateSchema = z
  .object({
    override_type: z.enum(["add", "suppress", "replace"]),
    holiday_date: isoDate,
    replaces_holiday_id: z.string().uuid().optional().nullable(),
    name: z.string().trim().min(1).max(160).optional().nullable(),
    notes: optionalText(500),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.override_type === "add" && !value.name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Name is required for company closures.",
        path: ["name"],
      });
    }
    if (value.override_type === "replace" && !value.replaces_holiday_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick the gazetted holiday to move.",
        path: ["replaces_holiday_id"],
      });
    }
    if (
      value.override_type === "suppress" &&
      !value.replaces_holiday_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick the gazetted holiday to hide.",
        path: ["replaces_holiday_id"],
      });
    }
  });

export const attendanceClockInSchema = z
  .object({
    employee_id: z.string().uuid(),
    notes: optionalText(500),
  })
  .strict();

export const attendanceClockOutSchema = z
  .object({
    notes: optionalText(500),
  })
  .strict();

export const WARNING_LETTER_SEVERITIES = [
  "verbal",
  "standard",
  "final",
] as const;

export const warningLetterCreateSchema = z
  .object({
    employee_id: z.string().uuid(),
    issued_at: isoDate,
    reason: z.string().trim().min(1).max(2000),
    severity: z.enum(WARNING_LETTER_SEVERITIES).default("standard"),
    admin_file_id: z.preprocess(
      emptyToNull,
      z.string().uuid().nullable().optional(),
    ),
  })
  .strict();

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;
export type LeaveCreateInput = z.infer<typeof leaveCreateSchema>;
export type PublicLeaveCreateInput = z.infer<typeof publicLeaveCreateSchema>;
export type LeaveStatusUpdateInput = z.infer<typeof leaveStatusUpdateSchema>;
export type EmployeeDocumentCreateInput = z.infer<
  typeof employeeDocumentCreateSchema
>;
export type OnboardingCreateInput = z.infer<typeof onboardingCreateSchema>;
export type OnboardingStatusUpdateInput = z.infer<
  typeof onboardingStatusUpdateSchema
>;
export type AppraisalCreateInput = z.infer<typeof appraisalCreateSchema>;
export type AppraisalUpdateInput = z.infer<typeof appraisalUpdateSchema>;
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;
export type HolidayOverrideCreateInput = z.infer<
  typeof holidayOverrideCreateSchema
>;

const payslipMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM format");

export const payslipCreateSchema = z
  .object({
    employee_id: z.string().uuid(),
    month: payslipMonth,
  })
  .strict();

export type PayslipCreateInput = z.infer<typeof payslipCreateSchema>;
export type AttendanceClockInInput = z.infer<typeof attendanceClockInSchema>;
export type AttendanceClockOutInput = z.infer<typeof attendanceClockOutSchema>;
export type WarningLetterCreateInput = z.infer<typeof warningLetterCreateSchema>;
