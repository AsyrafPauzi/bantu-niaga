import { z } from "zod";

export const OPERATIONS_ORDER_STATUSES = [
  "todo",
  "in_progress",
  "done",
] as const;
export type OperationsOrderStatus =
  (typeof OPERATIONS_ORDER_STATUSES)[number];

export const operationsOrderCreateSchema = z
  .object({
    customer_name: z
      .string()
      .trim()
      .min(1, "Customer name is required.")
      .max(200),
    customer_phone: z.string().trim().max(40).optional().nullable(),
    title: z.string().trim().min(1, "What are they ordering?").max(300),
    description: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(OPERATIONS_ORDER_STATUSES).optional().default("todo"),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
      .optional()
      .nullable(),
    amount_myr: z.coerce.number().min(0).optional().nullable(),
    supplier_id: z.string().uuid().optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export const operationsOrderUpdateSchema = z
  .object({
    customer_name: z.string().trim().min(1).max(200).optional(),
    customer_phone: z.string().trim().max(40).optional().nullable(),
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(OPERATIONS_ORDER_STATUSES).optional(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    amount_myr: z.coerce.number().min(0).optional().nullable(),
    supplier_id: z.string().uuid().optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export interface OperationsOrderRow {
  id: string;
  business_id: string;
  number: string;
  customer_name: string;
  customer_phone: string | null;
  title: string;
  description: string | null;
  status: OperationsOrderStatus;
  due_date: string | null;
  amount_myr: number | null;
  supplier_id: string | null;
  notes: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  supplier_name?: string | null;
}

export const operationsSupplierCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Supplier name is required.").max(200),
    contact_name: z.string().trim().max(200).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
    email: z
      .string()
      .trim()
      .email("Invalid email.")
      .optional()
      .nullable()
      .or(z.literal("")),
    address: z.string().trim().max(500).optional().nullable(),
    payment_terms: z.string().trim().max(200).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export const operationsSupplierUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    contact_name: z.string().trim().max(200).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
    email: z
      .string()
      .trim()
      .email()
      .optional()
      .nullable()
      .or(z.literal("")),
    address: z.string().trim().max(500).optional().nullable(),
    payment_terms: z.string().trim().max(200).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export interface OperationsSupplierRow {
  id: string;
  business_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OperationsSummary {
  open_orders: number;
  todo_count: number;
  in_progress_count: number;
  done_this_month: number;
  supplier_count: number;
  overdue_count: number;
}

export function formatOrderAmount(amount: number | null): string | null {
  if (amount == null) return null;
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function orderStatusLabel(status: OperationsOrderStatus): string {
  switch (status) {
    case "todo":
      return "To do";
    case "in_progress":
      return "In progress";
    case "done":
      return "Done";
  }
}
