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

export const LEAVE_TYPES = ["annual", "emergency", "mc"] as const;

export const LEAVE_STATUSES = ["pending", "approved", "rejected"] as const;

export const DOCUMENT_TYPES = [
  "ic",
  "passport",
  "bank",
  "medical",
  "contract",
  "other",
] as const;

export const employeeCreateSchema = z
  .object({
    full_name: z.string().trim().min(1).max(160),
    employment_type: z.enum(EMPLOYMENT_TYPES),
    role_title: z.string().trim().min(1).max(120),
    start_date: isoDate,
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
  })
  .strict();

export const employeeUpdateSchema = employeeCreateSchema.partial().refine(
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

export const holidayCreateSchema = z
  .object({
    state_code: optionalText(12),
    holiday_date: isoDate,
    name: z.string().trim().min(1).max(160),
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
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;
