import { z } from "zod";

/** @deprecated Legacy statuses — use task columns (`column_id`) instead. */
export const ADMIN_TASK_STATUSES = ["todo", "doing", "done"] as const;
export type AdminTaskStatus = (typeof ADMIN_TASK_STATUSES)[number];

export const ADMIN_COMPLIANCE_CATEGORIES = [
  "ssm",
  "dbkl",
  "halal",
  "food_handler",
  "insurance",
  "tenancy",
  "tax",
  "bomba",
  "local_council",
  "other",
] as const;
export type AdminComplianceCategory =
  (typeof ADMIN_COMPLIANCE_CATEGORIES)[number];

export const ADMIN_COMPLIANCE_STATUSES = [
  "active",
  "renewed",
  "archived",
] as const;
export type AdminComplianceStatus =
  (typeof ADMIN_COMPLIANCE_STATUSES)[number];

export { COMPLIANCE_PRESETS, DEFAULT_COMPLIANCE_REMIND_DAYS } from "@/lib/admin/compliance-shared";

export const adminTaskCreateSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    column_id: z.string().uuid().optional(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
      .optional()
      .nullable(),
    assignee_user_id: z.string().uuid().optional().nullable(),
    admin_file_id: z.string().uuid().optional().nullable(),
  })
  .strict();

export const adminTaskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    column_id: z.string().uuid().optional(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    assignee_user_id: z.string().uuid().optional().nullable(),
    admin_file_id: z.string().uuid().optional().nullable(),
  })
  .strict();

export const adminComplianceCreateSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200),
    category: z.enum(ADMIN_COMPLIANCE_CATEGORIES).optional().default("other"),
    authority: z.string().trim().max(120).optional().nullable(),
    reference_number: z.string().trim().max(120).optional().nullable(),
    expires_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date is required (YYYY-MM-DD)."),
    notes: z.string().trim().max(2000).optional().nullable(),
    remind_days: z
      .array(z.number().int().min(1).max(365))
      .min(1)
      .max(5)
      .optional(),
    admin_file_id: z.string().uuid().optional().nullable(),
  })
  .strict();

export const adminComplianceUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    category: z.enum(ADMIN_COMPLIANCE_CATEGORIES).optional(),
    authority: z.string().trim().max(120).optional().nullable(),
    reference_number: z.string().trim().max(120).optional().nullable(),
    expires_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(ADMIN_COMPLIANCE_STATUSES).optional(),
    /** When marking renewed, set the next expiry date. */
    next_expires_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    remind_days: z
      .array(z.number().int().min(1).max(365))
      .min(1)
      .max(5)
      .optional(),
    admin_file_id: z.string().uuid().optional().nullable(),
  })
  .strict();

export interface AdminTaskRow {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  column_id: string;
  due_date: string | null;
  assignee_user_id: string | null;
  created_by: string;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee_name?: string | null;
  column_label?: string | null;
  column_is_done?: boolean;
  admin_file_id?: string | null;
  admin_file_name?: string | null;
}

export interface AdminComplianceRow {
  id: string;
  business_id: string;
  title: string;
  category: AdminComplianceCategory;
  authority: string | null;
  reference_number: string | null;
  expires_on: string;
  remind_days: number[];
  notes: string | null;
  status: AdminComplianceStatus;
  last_renewed_at: string | null;
  admin_file_id: string | null;
  created_at: string;
  updated_at: string;
  days_until_expiry?: number;
  urgency?: "overdue" | "soon" | "ok";
  admin_file_name?: string | null;
}

export interface AdminComplianceRenewalEvent {
  id: string;
  compliance_item_id: string;
  previous_expires_on: string;
  new_expires_on: string;
  renewed_by: string | null;
  admin_file_id: string | null;
  admin_file_name?: string | null;
  created_at: string;
}

export interface ComplianceInAppAlert {
  id: string;
  business_id: string;
  compliance_item_id: string;
  notice_date: string;
  days_before: number;
  message: string;
  dismissed_at: string | null;
  created_at: string;
}

export function categoryLabel(category: AdminComplianceCategory): string {
  const labels: Record<AdminComplianceCategory, string> = {
    ssm: "SSM",
    dbkl: "DBKL",
    halal: "Halal",
    food_handler: "Food handler",
    insurance: "Insurance",
    tenancy: "Tenancy",
    tax: "Tax / LHDN",
    bomba: "BOMBA / Fire",
    local_council: "Local council",
    other: "Other",
  };
  return labels[category];
}

export function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function complianceUrgency(
  expiresOn: string,
): "overdue" | "soon" | "ok" {
  const d = daysUntil(expiresOn);
  if (d < 0) return "overdue";
  if (d <= 30) return "soon";
  return "ok";
}
