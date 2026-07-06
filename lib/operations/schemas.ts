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
  product_count: number;
  active_product_count: number;
  upcoming_bookings: number;
  resource_count: number;
}

export const OPERATIONS_BOOKING_STATUSES = [
  "held",
  "confirmed",
  "completed",
  "cancelled",
] as const;
export type OperationsBookingStatus =
  (typeof OPERATIONS_BOOKING_STATUSES)[number];

export const operationsProductCreateSchema = z
  .object({
    sku: z.string().trim().min(1, "SKU is required.").max(80),
    name: z.string().trim().min(1, "Product name is required.").max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    category: z.string().trim().max(100).optional().nullable(),
    price_myr: z.coerce.number().min(0).default(0),
    is_active: z.boolean().optional().default(true),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export const operationsProductUpdateSchema = z
  .object({
    sku: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    category: z.string().trim().max(100).optional().nullable(),
    price_myr: z.coerce.number().min(0).optional(),
    is_active: z.boolean().optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export interface OperationsProductRow {
  id: string;
  business_id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  price_myr: number;
  is_active: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const operationsBookingResourceCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Resource name is required.").max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    buffer_minutes: z.coerce.number().int().min(0).max(480).optional().default(0),
    is_active: z.boolean().optional().default(true),
  })
  .strict();

export const operationsBookingResourceUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    buffer_minutes: z.coerce.number().int().min(0).max(480).optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

export interface OperationsBookingResourceRow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  buffer_minutes: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const operationsBookingCreateSchema = z
  .object({
    resource_id: z.string().uuid().optional().nullable(),
    customer_name: z
      .string()
      .trim()
      .min(1, "Customer name is required.")
      .max(200),
    customer_phone: z.string().trim().max(40).optional().nullable(),
    service_title: z.string().trim().min(1, "Service is required.").max(300),
    starts_at: z.string().datetime({ message: "Invalid start time." }),
    ends_at: z.string().datetime({ message: "Invalid end time." }),
    status: z.enum(OPERATIONS_BOOKING_STATUSES).optional().default("held"),
    amount_myr: z.coerce.number().min(0).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict()
  .refine((v) => new Date(v.ends_at) > new Date(v.starts_at), {
    message: "End time must be after start time.",
    path: ["ends_at"],
  });

export const operationsBookingUpdateSchema = z
  .object({
    resource_id: z.string().uuid().optional().nullable(),
    customer_name: z.string().trim().min(1).max(200).optional(),
    customer_phone: z.string().trim().max(40).optional().nullable(),
    service_title: z.string().trim().min(1).max(300).optional(),
    starts_at: z.string().datetime().optional(),
    ends_at: z.string().datetime().optional(),
    status: z.enum(OPERATIONS_BOOKING_STATUSES).optional(),
    amount_myr: z.coerce.number().min(0).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export interface OperationsBookingRow {
  id: string;
  business_id: string;
  number: string;
  resource_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  service_title: string;
  starts_at: string;
  ends_at: string;
  status: OperationsBookingStatus;
  amount_myr: number | null;
  notes: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  resource_name?: string | null;
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

export function bookingStatusLabel(status: OperationsBookingStatus): string {
  switch (status) {
    case "held":
      return "Held";
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

export function formatBookingWhen(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = end.toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${startTime}–${endTime}`;
}
