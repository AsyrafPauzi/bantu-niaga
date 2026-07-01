import { z } from "zod";

export const FINANCE_TXN_KINDS = ["income", "expense"] as const;
export type FinanceTxnKind = (typeof FINANCE_TXN_KINDS)[number];

export const FINANCE_PAYMENT_METHODS = [
  "cash",
  "duitnow",
  "bank",
  "card",
  "other",
] as const;
export type FinancePaymentMethod = (typeof FINANCE_PAYMENT_METHODS)[number];

export const FINANCE_INVOICE_STATUSES = [
  "draft",
  "sent",
  "paid",
  "void",
] as const;
export type FinanceInvoiceStatus = (typeof FINANCE_INVOICE_STATUSES)[number];

export const FINANCE_EXPENSE_CATEGORIES = [
  "supplies",
  "rent",
  "utilities",
  "salaries",
  "marketing",
  "transport",
  "equipment",
  "other",
] as const;

export const FINANCE_INCOME_CATEGORIES = [
  "sales",
  "services",
  "invoice_payment",
  "other",
] as const;

export const financeTransactionCreateSchema = z
  .object({
    kind: z.enum(FINANCE_TXN_KINDS),
    amount_myr: z.number().positive("Amount must be greater than zero."),
    category: z.string().trim().max(80).optional().nullable(),
    description: z.string().trim().min(1, "Description is required.").max(500),
    counterparty: z.string().trim().max(200).optional().nullable(),
    payment_method: z.enum(FINANCE_PAYMENT_METHODS).optional().nullable(),
    txn_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
      .optional(),
  })
  .strict();

export const financeTransactionUpdateSchema = financeTransactionCreateSchema
  .partial()
  .strict();

export const financeInvoiceCreateSchema = z
  .object({
    customer_name: z.string().trim().min(1, "Customer name is required.").max(200),
    customer_email: z.string().trim().email().optional().nullable().or(z.literal("")),
    customer_phone: z.string().trim().max(30).optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable(),
    amount_myr: z.number().min(0),
    tax_myr: z.number().min(0).optional().default(0),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(FINANCE_INVOICE_STATUSES).optional().default("draft"),
  })
  .strict();

export const financeInvoiceUpdateSchema = z
  .object({
    customer_name: z.string().trim().min(1).max(200).optional(),
    customer_email: z.string().trim().email().optional().nullable().or(z.literal("")),
    customer_phone: z.string().trim().max(30).optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable(),
    amount_myr: z.number().min(0).optional(),
    tax_myr: z.number().min(0).optional(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(FINANCE_INVOICE_STATUSES).optional(),
  })
  .strict();

export interface FinanceTransactionRow {
  id: string;
  business_id: string;
  kind: FinanceTxnKind;
  amount_myr: number;
  category: string | null;
  description: string;
  counterparty: string | null;
  payment_method: string | null;
  txn_date: string;
  finance_invoice_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceInvoiceRow {
  id: string;
  business_id: string;
  number: string;
  share_hash: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  description: string | null;
  amount_myr: number;
  tax_myr: number;
  total_myr: number;
  status: FinanceInvoiceStatus;
  due_date: string | null;
  notes: string | null;
  paid_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceMonthSummary {
  month: string;
  income_myr: number;
  expense_myr: number;
  net_myr: number;
  invoice_paid_myr: number;
  invoice_outstanding_myr: number;
}

export function formatMyr(amount: number): string {
  return `RM ${amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function invoiceSharePath(idcompany: string, shareHash: string): string {
  return `/${idcompany}/inv-${shareHash}`;
}

export function invoiceShareUrl(
  appUrl: string,
  idcompany: string,
  shareHash: string,
): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}${invoiceSharePath(idcompany, shareHash)}`;
}

export function whatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function emailShareUrl(
  subject: string,
  body: string,
  to?: string,
): string {
  const params = new URLSearchParams({ subject, body });
  if (to) params.set("to", to);
  return `mailto:${to ?? ""}?${params.toString()}`;
}

export function buildInvoiceShareMessage(
  businessName: string,
  invoiceNumber: string,
  totalMyr: number,
  shareUrl: string,
): string {
  return (
    `Hi! Here is your invoice from ${businessName}.\n` +
    `Invoice: ${invoiceNumber}\n` +
    `Amount: ${formatMyr(totalMyr)}\n` +
    `View & pay: ${shareUrl}`
  );
}
