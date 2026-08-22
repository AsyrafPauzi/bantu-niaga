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
  "partially_paid",
] as const;
export type FinanceInvoiceStatus = (typeof FINANCE_INVOICE_STATUSES)[number];

export const FINANCE_DOCUMENT_KINDS = ["invoice", "quote"] as const;
export type FinanceDocumentKind = (typeof FINANCE_DOCUMENT_KINDS)[number];

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
  "capital",
  "loan",
  "grant",
  "refund",
  "other",
] as const;

/** Categories users can pick when logging income manually (excludes auto-posted invoice payments). */
export const FINANCE_INCOME_MANUAL_CATEGORIES = [
  "sales",
  "services",
  "capital",
  "loan",
  "grant",
  "refund",
  "other",
] as const;

export const FINANCE_INCOME_REVENUE_CATEGORIES = [
  "sales",
  "services",
  "invoice_payment",
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
    admin_file_id: z.string().uuid().optional().nullable(),
    operations_order_id: z.string().uuid().optional().nullable(),
  })
  .strict();

export const financeTransactionUpdateSchema = financeTransactionCreateSchema
  .partial()
  .strict();

export const financeInvoiceLineItemSchema = z.object({
  description: z.string().trim().min(1, "Line description is required.").max(2000),
  unit_price: z.number().min(0),
  quantity: z.number().positive(),
  unit: z.string().trim().max(40).optional().nullable(),
  taxable: z.boolean().optional().default(false),
  product_id: z.string().uuid().optional().nullable(),
});

export const financeInvoiceNumberSchema = z
  .string()
  .trim()
  .min(1, "Document number is required.")
  .max(40, "Document number is too long.")
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    "Use letters, numbers, hyphens, dots, or underscores only.",
  )
  .transform((value) => value.toUpperCase());

export const financeCustomerCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Customer name is required.").max(200),
    phone: z.string().trim().max(40).optional().nullable(),
    email: z
      .string()
      .trim()
      .email("Invalid email.")
      .optional()
      .nullable()
      .or(z.literal("")),
    address: z.string().trim().max(500).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export const financeCustomerUpdateSchema = financeCustomerCreateSchema.partial().strict();

export const financeInvoiceCreateSchema = z
  .object({
    customer_id: z.string().uuid().optional().nullable(),
    customer_name: z.string().trim().min(1).max(200).optional(),
    customer_email: z.string().trim().email().optional().nullable().or(z.literal("")),
    customer_phone: z.string().trim().max(30).optional().nullable(),
    title: z.string().trim().max(300).optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable(),
    invoice_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    items: z.array(financeInvoiceLineItemSchema).optional(),
    amount_myr: z.number().min(0).optional(),
    discount_myr: z.number().min(0).optional().default(0),
    discount_pct: z.number().min(0).max(100).optional().default(0),
    tax_myr: z.number().min(0).optional().default(0),
    tax_pct: z.number().min(0).max(100).optional().default(0),
    shipping_myr: z.number().min(0).optional().default(0),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(FINANCE_INVOICE_STATUSES).optional().default("draft"),
    document_kind: z.enum(FINANCE_DOCUMENT_KINDS).optional().default("invoice"),
    number: financeInvoiceNumberSchema.optional(),
    show_duitnow: z.boolean().optional().default(true),
    admin_file_id: z.string().uuid().optional().nullable(),
    sales_lead_id: z.string().uuid().optional().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.customer_id && !data.customer_name?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Select a customer or enter a customer name.",
        path: ["customer_name"],
      });
    }
    if ((!data.items || data.items.length === 0) && data.amount_myr == null) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least one line item.",
        path: ["items"],
      });
    }
  });

export const financeInvoiceUpdateSchema = z
  .object({
    customer_id: z.string().uuid().optional().nullable(),
    customer_name: z.string().trim().min(1).max(200).optional(),
    customer_email: z.string().trim().email().optional().nullable().or(z.literal("")),
    customer_phone: z.string().trim().max(30).optional().nullable(),
    title: z.string().trim().max(300).optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable(),
    invoice_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    items: z.array(financeInvoiceLineItemSchema).optional(),
    amount_myr: z.number().min(0).optional(),
    discount_myr: z.number().min(0).optional(),
    discount_pct: z.number().min(0).max(100).optional(),
    tax_myr: z.number().min(0).optional(),
    tax_pct: z.number().min(0).max(100).optional(),
    shipping_myr: z.number().min(0).optional(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(FINANCE_INVOICE_STATUSES).optional(),
    document_kind: z.enum(FINANCE_DOCUMENT_KINDS).optional(),
    number: financeInvoiceNumberSchema.optional(),
    show_duitnow: z.boolean().optional(),
    admin_file_id: z.string().uuid().optional().nullable(),
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
  operations_order_id?: string | null;
  operations_booking_id?: string | null;
  customer_id?: string | null;
  admin_file_id: string | null;
  admin_file_name?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceInvoiceItemRow {
  id: string;
  business_id: string;
  invoice_id: string;
  description: string;
  unit_price: number;
  quantity: number;
  unit: string | null;
  taxable: boolean;
  sort_order: number;
  line_total_myr: number;
  product_id?: string | null;
}

export interface FinanceCustomerRow {
  id: string;
  business_id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceInvoiceRow {
  id: string;
  business_id: string;
  number: string;
  share_hash: string;
  share_issued_at: string | null;
  share_expires_at: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  title: string | null;
  description: string | null;
  invoice_date: string;
  amount_myr: number;
  discount_myr: number;
  discount_pct: number;
  tax_myr: number;
  tax_pct: number;
  shipping_myr: number;
  total_myr: number;
  amount_paid_myr: number;
  status: FinanceInvoiceStatus;
  due_date: string | null;
  notes: string | null;
  paid_at: string | null;
  sent_at: string | null;
  document_kind: FinanceDocumentKind;
  show_duitnow: boolean;
  converted_from_id: string | null;
  admin_file_id: string | null;
  admin_file_name?: string | null;
  sales_lead_id?: string | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
  items?: FinanceInvoiceItemRow[];
}

export interface FinanceMonthSummary {
  month: string;
  income_myr: number;
  expense_myr: number;
  net_myr: number;
  invoice_paid_myr: number;
  invoice_outstanding_myr: number;
}

export interface FinancePnLLine {
  category: string;
  label: string;
  amount_myr: number;
  count: number;
}

/** Profit & loss statement for a calendar month (revenue − expenses). */
export interface FinancePnLStatement {
  period_start: string;
  period_end: string;
  period_label: string;
  /** Calendar month key (`YYYY-MM`) when the period is a full month — used for CSV export. */
  month: string;
  revenue_lines: FinancePnLLine[];
  total_revenue_myr: number;
  expense_lines: FinancePnLLine[];
  total_expenses_myr: number;
  net_profit_myr: number;
  /** Capital, loans, etc. — cash in but not P&L revenue. */
  excluded_cash_in: FinancePnLLine[];
  total_excluded_cash_in_myr: number;
}

export function formatMyr(amount: number): string {
  return `RM ${amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** e.g. "14 Aug" — used on quote PDFs and public links. */
export function formatFinanceShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
}

export const QUOTE_DEFAULT_VALIDITY_DAYS = 14;

export function formatQuoteValidUntil(iso: string): string {
  return `Valid until ${formatFinanceShortDate(iso)}`;
}

export function quoteValidityDays(
  quoteDate: string,
  validUntil: string,
): number {
  const ms =
    new Date(`${validUntil}T12:00:00`).getTime() -
    new Date(`${quoteDate}T12:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

export function defaultQuoteTermsNote(
  quoteDate: string,
  validUntil: string,
): string {
  return `Prices valid ${quoteValidityDays(quoteDate, validUntil)} days.`;
}

const QUOTE_TERMS_PATTERN = /^Prices valid \d+ days\.?$/;

export function isDefaultQuoteTermsNote(note: string): boolean {
  return QUOTE_TERMS_PATTERN.test(note.trim());
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

export function buildQuoteShareMessage(
  businessName: string,
  quoteNumber: string,
  totalMyr: number,
  shareUrl: string,
  validUntil?: string | null,
): string {
  const expiryLine = validUntil
    ? `${formatQuoteValidUntil(validUntil)}\n`
    : "";
  return (
    `Hi! Here is your quote from ${businessName}.\n` +
    `Quote: ${quoteNumber}\n` +
    `Amount: ${formatMyr(totalMyr)}\n` +
    expiryLine +
    `View: ${shareUrl}`
  );
}
