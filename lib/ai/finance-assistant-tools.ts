import "server-only";

import { z } from "zod";
import type { AgentContext } from "@/lib/ai/context/types";
import { loadFinanceAnalyticsForRange } from "@/lib/finance/analytics";
import {
  computeFinanceMonthSummary,
  computeFinancePnLStatement,
  computeFinancePnLStatementForRange,
  generateShareHash,
  nextFinanceInvoiceNumber,
} from "@/lib/finance/helpers";
import { loadFinanceInvoicesSummary } from "@/lib/finance/invoices-summary";
import {
  INVOICE_SELECT,
  buildTotalsFromPayload,
  loadInvoiceWithItems,
  replaceInvoiceItems,
  resolveCustomerSnapshot,
} from "@/lib/finance/invoice-db";
import { dispatchInvoicePaid } from "@/lib/finance/dispatch-invoice-paid";
import { renderFinanceInvoicePdf } from "@/lib/finance/invoice-pdf";
import {
  FINANCE_EXPENSE_CATEGORIES,
  FINANCE_INCOME_MANUAL_CATEGORIES,
  FINANCE_INVOICE_STATUSES,
  FINANCE_PAYMENT_METHODS,
  buildInvoiceShareMessage,
  financeCustomerCreateSchema,
  financeCustomerUpdateSchema,
  financeTransactionCreateSchema,
  invoiceShareUrl,
  type FinanceInvoiceRow,
} from "@/lib/finance/schemas";
import { sendEmail } from "@/lib/marketing/email-resend";
import { normalizeMyPhone } from "@/lib/marketing/phone";
import { loadBusiness } from "@/lib/settings/business";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export function malaysiaTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

function sanitizeLike(raw: string): string {
  return raw.replace(/[%_\\]/g, "");
}

type FindResult<T> =
  | T
  | { ambiguous: true; matches: Array<{ id: string; label: string }> }
  | null;

async function findCustomer(
  businessId: string,
  opts: { customer_id?: string; customer_name?: string },
): Promise<FindResult<{ id: string; name: string; email: string | null; phone_e164: string | null }>> {
  const supabase = await createSupabaseServerClient();
  if (opts.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select("id, name, email, phone_e164")
      .eq("business_id", businessId)
      .eq("id", opts.customer_id)
      .is("deleted_at", null)
      .maybeSingle();
    return data as { id: string; name: string; email: string | null; phone_e164: string | null } | null;
  }
  if (opts.customer_name) {
    const safe = sanitizeLike(opts.customer_name);
    const { data } = await supabase
      .from("customers")
      .select("id, name, email, phone_e164")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .ilike("name", `%${safe}%`)
      .limit(5);
    if (!data?.length) return null;
    if (data.length > 1) {
      return {
        ambiguous: true,
        matches: data.map((d) => ({ id: d.id, label: d.name })),
      };
    }
    return data[0] as { id: string; name: string; email: string | null; phone_e164: string | null };
  }
  return null;
}

async function findInvoice(
  businessId: string,
  opts: { invoice_id?: string; invoice_number?: string },
): Promise<FindResult<FinanceInvoiceRow>> {
  const supabase = await createSupabaseServerClient();
  if (opts.invoice_id) {
    const row = await loadInvoiceWithItems(supabase, businessId, opts.invoice_id);
    return row;
  }
  if (opts.invoice_number) {
    const safe = sanitizeLike(opts.invoice_number);
    const { data } = await supabase
      .from("finance_invoices")
      .select(INVOICE_SELECT)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .ilike("number", `%${safe}%`)
      .limit(5);
    if (!data?.length) return null;
    const rows = data as unknown as FinanceInvoiceRow[];
    if (rows.length > 1) {
      return {
        ambiguous: true,
        matches: rows.map((d) => ({
          id: d.id,
          label: `${d.number} · ${d.customer_name}`,
        })),
      };
    }
    return rows[0];
  }
  return null;
}

export const FINANCE_ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_finance_overview",
      description: "MTD income/expense/net, invoice summary counts, outstanding RM.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_invoices",
      description: "List invoices or quotes with optional filters.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: [...FINANCE_INVOICE_STATUSES] },
          document_kind: { type: "string", enum: ["invoice", "quote"] },
          overdue_only: { type: "boolean" },
          customer_name: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_invoice",
      description: "Get one invoice or quote by number or id.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          invoice_number: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_transactions",
      description: "List ledger income or expense transactions.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["income", "expense"] },
          month: { type: "string", description: "YYYY-MM" },
          category: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_customers",
      description: "Search billing customers by name, phone, or email.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_pnl_summary",
      description: "Profit & loss summary for a month or date range.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "YYYY-MM" },
          from: { type: "string", description: "YYYY-MM-DD" },
          to: { type: "string", description: "YYYY-MM-DD" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_analytics",
      description: "Income vs expense analytics for a date range.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", enum: [1, 2, 3, 5, 7, 14, 30] },
          from: { type: "string" },
          to: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_chase_list",
      description: "Prioritized list of overdue and outstanding sent invoices.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "month_end_checklist",
      description: "Month-end finance checklist from live data.",
      parameters: {
        type: "object",
        properties: { month: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "draft_chase_message",
      description: "Draft WhatsApp/email chase copy for one invoice (does not send).",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          invoice_number: { type: "string" },
          tone: { type: "string", enum: ["friendly", "firm"] },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_pay_link",
      description: "Public pay link for an invoice.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          invoice_number: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_income",
      description: "Log manual income in the ledger.",
      parameters: {
        type: "object",
        properties: {
          amount_myr: { type: "number" },
          description: { type: "string" },
          category: { type: "string", enum: [...FINANCE_INCOME_MANUAL_CATEGORIES] },
          counterparty: { type: "string" },
          payment_method: { type: "string", enum: [...FINANCE_PAYMENT_METHODS] },
          txn_date: { type: "string" },
        },
        required: ["amount_myr", "description"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_expense",
      description: "Log an expense in the ledger.",
      parameters: {
        type: "object",
        properties: {
          amount_myr: { type: "number" },
          description: { type: "string" },
          category: { type: "string", enum: [...FINANCE_EXPENSE_CATEGORIES] },
          counterparty: { type: "string" },
          payment_method: { type: "string", enum: [...FINANCE_PAYMENT_METHODS] },
          txn_date: { type: "string" },
        },
        required: ["amount_myr", "description"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_customer",
      description: "Save a billing customer for invoices.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_customer",
      description: "Update a customer by name or id.",
      parameters: {
        type: "object",
        properties: {
          customer_id: { type: "string" },
          customer_name: { type: "string" },
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_invoice",
      description:
        "Create an invoice or quote. Provide customer + amount or line description.",
      parameters: {
        type: "object",
        properties: {
          document_kind: { type: "string", enum: ["invoice", "quote"] },
          customer_id: { type: "string" },
          customer_name: { type: "string" },
          customer_email: { type: "string" },
          customer_phone: { type: "string" },
          amount_myr: { type: "number" },
          description: { type: "string", description: "Line item / title" },
          title: { type: "string" },
          due_date: { type: "string" },
          status: { type: "string", enum: ["draft", "sent"] },
          notes: { type: "string" },
        },
        required: ["amount_myr"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_invoice_status",
      description: "Mark invoice sent, paid, or void. User must confirm void/paid.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          invoice_number: { type: "string" },
          status: { type: "string", enum: ["draft", "sent", "paid", "void"] },
          user_confirmed: {
            type: "boolean",
            description: "True only after user explicitly confirmed void or paid.",
          },
        },
        required: ["status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "convert_quote_to_invoice",
      description: "Convert a quote to a draft invoice.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          invoice_number: { type: "string" },
          due_date: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_invoice_email",
      description: "Email invoice PDF to customer. Requires customer email.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          invoice_number: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
] as const;

const ACTION_TOOLS = new Set([
  "log_income",
  "log_expense",
  "create_customer",
  "update_customer",
  "create_invoice",
  "update_invoice_status",
  "convert_quote_to_invoice",
  "send_invoice_email",
]);

export function isFinanceActionTool(name: string): boolean {
  return ACTION_TOOLS.has(name);
}

const logTxnSchema = financeTransactionCreateSchema;
const createCustomerSchema = financeCustomerCreateSchema;
const updateCustomerSchema = financeCustomerUpdateSchema.extend({
  customer_id: z.string().uuid().optional(),
  customer_name: z.string().trim().min(1).max(200).optional(),
});

const createInvoiceToolSchema = z.object({
  document_kind: z.enum(["invoice", "quote"]).optional().default("invoice"),
  customer_id: z.string().uuid().optional(),
  customer_name: z.string().trim().max(200).optional(),
  customer_email: z.string().trim().email().optional().nullable().or(z.literal("")),
  customer_phone: z.string().trim().max(30).optional().nullable(),
  amount_myr: z.number().positive(),
  description: z.string().trim().min(1).max(500).optional(),
  title: z.string().trim().max(300).optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(["draft", "sent"]).optional().default("draft"),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const updateStatusSchema = z.object({
  invoice_id: z.string().uuid().optional(),
  invoice_number: z.string().trim().min(1).max(40).optional(),
  status: z.enum(FINANCE_INVOICE_STATUSES),
  user_confirmed: z.boolean().optional(),
});

export async function executeFinanceAssistantTool(
  ctx: AgentContext,
  name: string,
  args: unknown,
): Promise<Record<string, unknown>> {
  const supabase = await createSupabaseServerClient();
  const admin = createServiceRoleClient();
  const today = malaysiaTodayIso();

  try {
    if (name === "get_finance_overview") {
      const [monthSummary, invSummary] = await Promise.all([
        computeFinanceMonthSummary(admin, ctx.businessId),
        loadFinanceInvoicesSummary(supabase, ctx.businessId),
      ]);
      return {
        ok: true,
        month: monthSummary.month,
        income_myr: monthSummary.income_myr,
        expense_myr: monthSummary.expense_myr,
        net_myr: monthSummary.net_myr,
        invoices: invSummary,
      };
    }

    if (name === "list_invoices") {
      const parsed = z
        .object({
          status: z.enum(FINANCE_INVOICE_STATUSES).optional(),
          document_kind: z.enum(["invoice", "quote"]).optional(),
          overdue_only: z.boolean().optional(),
          customer_name: z.string().optional(),
          limit: z.number().int().min(1).max(50).optional().default(20),
        })
        .parse(args ?? {});

      let query = supabase
        .from("finance_invoices")
        .select(
          "id, number, customer_name, total_myr, status, due_date, invoice_date, document_kind",
        )
        .eq("business_id", ctx.businessId)
        .is("deleted_at", null)
        .neq("status", "void")
        .order("created_at", { ascending: false })
        .limit(parsed.limit);

      if (parsed.status) query = query.eq("status", parsed.status);
      if (parsed.document_kind) query = query.eq("document_kind", parsed.document_kind);
      if (parsed.customer_name) {
        query = query.ilike("customer_name", `%${sanitizeLike(parsed.customer_name)}%`);
      }
      if (parsed.overdue_only) {
        query = query.eq("status", "sent").lt("due_date", today);
      }

      const { data, error } = await query;
      if (error) return { ok: false, error: error.message };
      return { ok: true, invoices: data ?? [] };
    }

    if (name === "get_invoice") {
      const parsed = z
        .object({
          invoice_id: z.string().uuid().optional(),
          invoice_number: z.string().optional(),
        })
        .parse(args ?? {});
      if (!parsed.invoice_id && !parsed.invoice_number) {
        return { ok: false, error: "invoice_id_or_number_required" };
      }
      const found = await findInvoice(ctx.businessId, parsed);
      if (!found) return { ok: false, error: "invoice_not_found" };
      if ("ambiguous" in found && found.ambiguous) {
        return { ok: false, error: "ambiguous_invoice", matches: found.matches };
      }
      const inv = found as FinanceInvoiceRow;
      return {
        ok: true,
        invoice: {
          id: inv.id,
          number: inv.number,
          customer_name: inv.customer_name,
          total_myr: inv.total_myr,
          status: inv.status,
          due_date: inv.due_date,
          document_kind: inv.document_kind,
        },
        href: `/finance/invoices/${inv.id}/edit`,
      };
    }

    if (name === "list_transactions") {
      const parsed = z
        .object({
          kind: z.enum(["income", "expense"]).optional(),
          month: z.string().optional(),
          category: z.string().optional(),
          limit: z.number().int().min(1).max(50).optional().default(20),
        })
        .parse(args ?? {});

      let query = supabase
        .from("finance_transactions")
        .select("id, kind, amount_myr, category, description, txn_date, counterparty")
        .eq("business_id", ctx.businessId)
        .is("deleted_at", null)
        .order("txn_date", { ascending: false })
        .limit(parsed.limit);

      if (parsed.kind) query = query.eq("kind", parsed.kind);
      if (parsed.category) query = query.eq("category", parsed.category);
      if (parsed.month && /^\d{4}-\d{2}$/.test(parsed.month)) {
        const [y, m] = parsed.month.split("-").map(Number);
        const start = `${y}-${String(m).padStart(2, "0")}-01`;
        const endDate = new Date(y, m, 0);
        const end = `${y}-${String(m).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
        query = query.gte("txn_date", start).lte("txn_date", end);
      }

      const { data, error } = await query;
      if (error) return { ok: false, error: error.message };
      return { ok: true, transactions: data ?? [] };
    }

    if (name === "list_customers") {
      const parsed = z
        .object({
          q: z.string().optional(),
          limit: z.number().int().min(1).max(50).optional().default(20),
        })
        .parse(args ?? {});

      let query = supabase
        .from("customers")
        .select("id, name, phone_e164, email")
        .eq("business_id", ctx.businessId)
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .limit(parsed.limit);

      if (parsed.q?.trim()) {
        const safe = sanitizeLike(parsed.q.trim());
        query = query.or(
          `name.ilike.%${safe}%,email.ilike.%${safe}%,phone_e164.ilike.%${safe}%`,
        );
      }

      const { data, error } = await query;
      if (error) return { ok: false, error: error.message };
      return { ok: true, customers: data ?? [] };
    }

    if (name === "get_pnl_summary") {
      const parsed = z
        .object({
          month: z.string().optional(),
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .parse(args ?? {});

      if (parsed.from && parsed.to) {
        const pnl = await computeFinancePnLStatementForRange(
          admin,
          ctx.businessId,
          parsed.from,
          parsed.to,
          `${parsed.from} – ${parsed.to}`,
        );
        return { ok: true, pnl };
      }

      const pnl = await computeFinancePnLStatement(admin, ctx.businessId, parsed.month);
      return { ok: true, pnl };
    }

    if (name === "get_analytics") {
      const parsed = z
        .object({
          days: z.union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(5),
            z.literal(7),
            z.literal(14),
            z.literal(30),
          ]).optional(),
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .parse(args ?? {});

      let start: string;
      let end: string;
      if (parsed.from && parsed.to) {
        start = parsed.from;
        end = parsed.to;
      } else {
        const d = parsed.days ?? 7;
        end = today;
        const dt = new Date(`${end}T12:00:00`);
        dt.setDate(dt.getDate() - (d - 1));
        start = dt.toISOString().slice(0, 10);
      }

      const analytics = await loadFinanceAnalyticsForRange(
        admin,
        ctx.businessId,
        start,
        end,
      );
      return { ok: true, analytics };
    }

    if (name === "get_chase_list") {
      const parsed = z
        .object({ limit: z.number().int().min(1).max(20).optional().default(10) })
        .parse(args ?? {});

      const { data } = await supabase
        .from("finance_invoices")
        .select("id, number, customer_name, total_myr, due_date, status")
        .eq("business_id", ctx.businessId)
        .eq("document_kind", "invoice")
        .eq("status", "sent")
        .is("deleted_at", null)
        .order("due_date", { ascending: true })
        .limit(50);

      const rows = (data ?? []).map((r) => ({
        ...r,
        overdue: r.due_date ? String(r.due_date) < today : false,
      }));
      rows.sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return Number(b.total_myr) - Number(a.total_myr);
      });

      return { ok: true, chase_list: rows.slice(0, parsed.limit) };
    }

    if (name === "month_end_checklist") {
      const parsed = z.object({ month: z.string().optional() }).parse(args ?? {});
      const [monthSummary, invSummary] = await Promise.all([
        computeFinanceMonthSummary(admin, ctx.businessId, parsed.month),
        loadFinanceInvoicesSummary(supabase, ctx.businessId),
      ]);
      const items: string[] = [];
      if (invSummary.draft_count > 0) {
        items.push(`${invSummary.draft_count} draft invoice(s) — send or void`);
      }
      if (invSummary.overdue_count > 0) {
        items.push(`${invSummary.overdue_count} overdue — chase payment`);
      }
      if (invSummary.sent_count > 0) {
        items.push(
          `RM ${invSummary.outstanding_myr.toFixed(2)} outstanding across ${invSummary.sent_count} sent invoice(s)`,
        );
      }
      if (monthSummary.net_myr < 0) {
        items.push("Expenses exceed income this month — review spending");
      }
      if (items.length === 0) {
        items.push("Books look tidy — log any missing expenses and reconcile bank");
      }
      return { ok: true, month: monthSummary.month, checklist: items, summary: monthSummary };
    }

    if (name === "draft_chase_message") {
      const parsed = z
        .object({
          invoice_id: z.string().uuid().optional(),
          invoice_number: z.string().optional(),
          tone: z.enum(["friendly", "firm"]).optional().default("friendly"),
        })
        .parse(args ?? {});

      const found = await findInvoice(ctx.businessId, parsed);
      if (!found || ("ambiguous" in found && found.ambiguous)) {
        return { ok: false, error: "invoice_not_found" };
      }
      const inv = found as FinanceInvoiceRow;
      const business = await loadBusiness(ctx.businessId);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
      const url =
        business && appUrl
          ? invoiceShareUrl(appUrl, business.idcompany, inv.share_hash)
          : "";
      const base = buildInvoiceShareMessage(
        business?.name ?? "Our business",
        inv.number,
        Number(inv.total_myr),
        url,
      );
      const prefix =
        parsed.tone === "firm"
          ? `Reminder: invoice ${inv.number} is overdue. `
          : `Hi ${inv.customer_name}, gentle reminder about `;
      return {
        ok: true,
        invoice_number: inv.number,
        whatsapp_draft: `${prefix}${base}`,
        pay_link: url || undefined,
      };
    }

    if (name === "get_pay_link") {
      const parsed = z
        .object({
          invoice_id: z.string().uuid().optional(),
          invoice_number: z.string().optional(),
        })
        .parse(args ?? {});
      const found = await findInvoice(ctx.businessId, parsed);
      if (!found || ("ambiguous" in found && found.ambiguous)) {
        return { ok: false, error: "invoice_not_found" };
      }
      const inv = found as FinanceInvoiceRow;
      const business = await loadBusiness(ctx.businessId);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
      if (!business || !appUrl) {
        return { ok: false, error: "pay_link_unavailable" };
      }
      return {
        ok: true,
        url: invoiceShareUrl(appUrl, business.idcompany, inv.share_hash),
        invoice_number: inv.number,
      };
    }

    if (name === "log_income" || name === "log_expense") {
      const raw = z.record(z.unknown()).parse(args ?? {});
      const parsed = logTxnSchema.parse({
        ...raw,
        kind: name === "log_income" ? "income" : "expense",
        txn_date: raw.txn_date ?? today,
      });
      const { data, error } = await supabase
        .from("finance_transactions")
        .insert({
          business_id: ctx.businessId,
          kind: parsed.kind,
          amount_myr: parsed.amount_myr,
          category: parsed.category ?? (parsed.kind === "income" ? "other" : "other"),
          description: parsed.description,
          counterparty: parsed.counterparty ?? null,
          payment_method: parsed.payment_method ?? "other",
          txn_date: parsed.txn_date ?? today,
          created_by: ctx.userId,
        })
        .select("id, kind, amount_myr, description, txn_date")
        .single();
      if (error || !data) return { ok: false, error: error?.message ?? "create_failed" };
      return {
        ok: true,
        transaction: data,
        href: parsed.kind === "income" ? "/finance/income" : "/finance/expenses",
      };
    }

    if (name === "create_customer") {
      const parsed = createCustomerSchema.parse(args);
      let phoneE164: string | null = null;
      if (parsed.phone?.trim()) {
        phoneE164 = normalizeMyPhone(parsed.phone.trim());
        if (!phoneE164) return { ok: false, error: "invalid_phone" };
      }
      const { data, error } = await supabase
        .from("customers")
        .insert({
          business_id: ctx.businessId,
          name: parsed.name,
          phone_e164: phoneE164,
          email: parsed.email || null,
          source: "manual",
          created_by_user_id: ctx.userId,
        })
        .select("id, name, phone_e164, email")
        .single();
      if (error || !data) return { ok: false, error: error?.message ?? "create_failed" };
      return { ok: true, customer: data, href: "/finance/customers" };
    }

    if (name === "update_customer") {
      const parsed = updateCustomerSchema.parse(args);
      if (!parsed.customer_id && !parsed.customer_name) {
        return { ok: false, error: "customer_id_or_name_required" };
      }
      const found = await findCustomer(ctx.businessId, {
        customer_id: parsed.customer_id,
        customer_name: parsed.customer_name,
      });
      if (!found) return { ok: false, error: "customer_not_found" };
      if ("ambiguous" in found && found.ambiguous) {
        return { ok: false, error: "ambiguous_customer", matches: found.matches };
      }
      const customer = found as { id: string };
      const patch: Record<string, unknown> = {};
      if (parsed.name) patch.name = parsed.name;
      if (parsed.email !== undefined) patch.email = parsed.email || null;
      if (parsed.phone !== undefined) {
        if (parsed.phone?.trim()) {
          const phone = normalizeMyPhone(parsed.phone.trim());
          if (!phone) return { ok: false, error: "invalid_phone" };
          patch.phone_e164 = phone;
        } else {
          patch.phone_e164 = null;
        }
      }
      if (Object.keys(patch).length === 0) return { ok: false, error: "no_fields" };
      const { data, error } = await supabase
        .from("customers")
        .update(patch)
        .eq("id", customer.id)
        .eq("business_id", ctx.businessId)
        .select("id, name, phone_e164, email")
        .single();
      if (error || !data) return { ok: false, error: error?.message ?? "update_failed" };
      return { ok: true, customer: data, href: "/finance/customers" };
    }

    if (name === "create_invoice") {
      const parsed = createInvoiceToolSchema.parse(args);
      if (!parsed.customer_id && !parsed.customer_name?.trim()) {
        return { ok: false, error: "customer_required" };
      }

      const customer = await resolveCustomerSnapshot(
        supabase,
        ctx.businessId,
        parsed.customer_id,
        {
          customer_name: parsed.customer_name,
          customer_email: parsed.customer_email,
          customer_phone: parsed.customer_phone,
        },
      );
      if (!customer.customer_name) {
        return { ok: false, error: "customer_not_found" };
      }

      const lineDesc = parsed.description ?? parsed.title ?? "Services";
      const totals = buildTotalsFromPayload({
        amount_myr: parsed.amount_myr,
        items: [{ unit_price: parsed.amount_myr, quantity: 1, taxable: false }],
      });
      const documentKind = parsed.document_kind ?? "invoice";
      const prefix = documentKind === "quote" ? "QUO" : "INV";
      const number = await nextFinanceInvoiceNumber(admin, ctx.businessId, prefix);
      const shareHash = generateShareHash();
      const status = parsed.status ?? "draft";
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("finance_invoices")
        .insert({
          business_id: ctx.businessId,
          number,
          share_hash: shareHash,
          customer_id: customer.customer_id,
          customer_name: customer.customer_name,
          customer_email: customer.customer_email,
          customer_phone: customer.customer_phone,
          title: parsed.title ?? lineDesc,
          invoice_date: today,
          amount_myr: totals.amount_myr,
          discount_myr: totals.discount_myr,
          tax_myr: totals.tax_myr,
          shipping_myr: totals.shipping_myr,
          total_myr: totals.total_myr,
          status,
          due_date: parsed.due_date ?? null,
          notes: parsed.notes ?? null,
          document_kind: documentKind,
          show_duitnow: documentKind === "invoice",
          sent_at: status === "sent" ? now : null,
          created_by: ctx.userId,
        })
        .select(INVOICE_SELECT)
        .single();

      if (error || !data) return { ok: false, error: error?.message ?? "create_failed" };

      const row = data as unknown as FinanceInvoiceRow;
      await replaceInvoiceItems(supabase, ctx.businessId, row.id, [
        { description: lineDesc, unit_price: parsed.amount_myr, quantity: 1, taxable: false },
      ]);

      return {
        ok: true,
        invoice: { id: row.id, number: row.number, total_myr: row.total_myr, status: row.status },
        href: `/finance/invoices/${row.id}/edit`,
      };
    }

    if (name === "update_invoice_status") {
      const parsed = updateStatusSchema.parse(args);
      if (!parsed.invoice_id && !parsed.invoice_number) {
        return { ok: false, error: "invoice_id_or_number_required" };
      }
      if (
        (parsed.status === "void" || parsed.status === "paid") &&
        !parsed.user_confirmed
      ) {
        return {
          ok: false,
          error: "confirmation_required",
          message: `Ask the user to confirm marking ${parsed.invoice_number ?? "this invoice"} as ${parsed.status} before calling the tool with user_confirmed: true.`,
        };
      }

      const found = await findInvoice(ctx.businessId, parsed);
      if (!found) return { ok: false, error: "invoice_not_found" };
      if ("ambiguous" in found && found.ambiguous) {
        return { ok: false, error: "ambiguous_invoice", matches: found.matches };
      }
      const current = found as FinanceInvoiceRow;
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { status: parsed.status };
      if (parsed.status === "sent") patch.sent_at = now;
      if (parsed.status === "paid") patch.paid_at = now;

      const { data, error } = await supabase
        .from("finance_invoices")
        .update(patch)
        .eq("id", current.id)
        .eq("business_id", ctx.businessId)
        .select(INVOICE_SELECT)
        .single();

      if (error || !data) return { ok: false, error: error?.message ?? "update_failed" };

      const row = await loadInvoiceWithItems(supabase, ctx.businessId, current.id);
      if (parsed.status === "paid" && row && current.status !== "paid") {
        await dispatchInvoicePaid({
          supabase,
          invoice: row,
          userId: ctx.userId,
        });
      }

      return {
        ok: true,
        invoice: { id: current.id, number: current.number, status: parsed.status },
        href: `/finance/invoices/${current.id}/edit`,
      };
    }

    if (name === "convert_quote_to_invoice") {
      const parsed = z
        .object({
          invoice_id: z.string().uuid().optional(),
          invoice_number: z.string().optional(),
          due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        })
        .parse(args ?? {});

      const found = await findInvoice(ctx.businessId, parsed);
      if (!found) return { ok: false, error: "quote_not_found" };
      if ("ambiguous" in found && found.ambiguous) {
        return { ok: false, error: "ambiguous_invoice", matches: found.matches };
      }
      const quote = await loadInvoiceWithItems(
        supabase,
        ctx.businessId,
        (found as FinanceInvoiceRow).id,
      );
      if (!quote || quote.document_kind !== "quote") {
        return { ok: false, error: "not_a_quote" };
      }

      const number = await nextFinanceInvoiceNumber(admin, ctx.businessId, "INV");
      const defaultDue = new Date();
      defaultDue.setDate(defaultDue.getDate() + 30);
      const dueDate =
        parsed.due_date !== undefined
          ? parsed.due_date
          : quote.due_date ?? defaultDue.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("finance_invoices")
        .insert({
          business_id: ctx.businessId,
          number,
          share_hash: generateShareHash(),
          customer_id: quote.customer_id,
          customer_name: quote.customer_name,
          customer_email: quote.customer_email,
          customer_phone: quote.customer_phone,
          title: quote.title,
          description: quote.description,
          invoice_date: quote.invoice_date,
          amount_myr: quote.amount_myr,
          discount_myr: quote.discount_myr,
          discount_pct: quote.discount_pct,
          tax_myr: quote.tax_myr,
          tax_pct: quote.tax_pct,
          shipping_myr: quote.shipping_myr,
          total_myr: quote.total_myr,
          status: "draft",
          due_date: dueDate,
          notes: quote.notes,
          document_kind: "invoice",
          show_duitnow: quote.show_duitnow,
          converted_from_id: quote.id,
          created_by: ctx.userId,
        })
        .select(INVOICE_SELECT)
        .single();

      if (error || !data) return { ok: false, error: error?.message ?? "convert_failed" };
      const row = data as unknown as FinanceInvoiceRow;
      if (quote.items?.length) {
        await replaceInvoiceItems(
          supabase,
          ctx.businessId,
          row.id,
          quote.items.map((item) => ({
            description: item.description,
            unit_price: Number(item.unit_price),
            quantity: Number(item.quantity),
            unit: item.unit,
            taxable: item.taxable,
          })),
        );
      }
      return {
        ok: true,
        invoice: { id: row.id, number: row.number, converted_from: quote.number },
        href: `/finance/invoices/${row.id}/edit`,
      };
    }

    if (name === "send_invoice_email") {
      const parsed = z
        .object({
          invoice_id: z.string().uuid().optional(),
          invoice_number: z.string().optional(),
        })
        .parse(args ?? {});

      const found = await findInvoice(ctx.businessId, parsed);
      if (!found) return { ok: false, error: "invoice_not_found" };
      if ("ambiguous" in found && found.ambiguous) {
        return { ok: false, error: "ambiguous_invoice", matches: found.matches };
      }

      const invoice = await loadInvoiceWithItems(
        supabase,
        ctx.businessId,
        (found as FinanceInvoiceRow).id,
      );
      if (!invoice) return { ok: false, error: "invoice_not_found" };
      if (!invoice.customer_email?.trim()) {
        return { ok: false, error: "customer_email_required" };
      }
      if (invoice.status === "void") {
        return { ok: false, error: "invoice_void" };
      }

      const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
      const fromEmail = process.env.MARKETING_FROM_EMAIL?.trim() ?? "";
      if (!apiKey || !fromEmail) {
        return { ok: false, error: "email_channel_not_configured" };
      }

      const business = await loadBusiness(ctx.businessId);
      if (!business) return { ok: false, error: "business_not_found" };

      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
      const shareUrl = appUrl
        ? invoiceShareUrl(appUrl, business.idcompany, invoice.share_hash)
        : "";
      const message = buildInvoiceShareMessage(
        business.name,
        invoice.number,
        Number(invoice.total_myr),
        shareUrl,
      );
      const pdfBytes = await renderFinanceInvoicePdf(invoice, business);
      const result = await sendEmail({
        to: invoice.customer_email.trim(),
        subject: `Invoice ${invoice.number} from ${business.name}`,
        body: `${message}\n\nPDF attached.`,
        fromEmail: `${business.email_from_name?.trim() || business.name} <${fromEmail}>`,
        apiKey,
        attachments: [
          {
            filename: `${invoice.number.replace(/[^\w-]+/g, "-")}.pdf`,
            content: Buffer.from(pdfBytes).toString("base64"),
          },
        ],
      });

      if (!result.ok) {
        return { ok: false, error: result.reason };
      }

      await supabase
        .from("finance_invoices")
        .update({
          status: invoice.status === "draft" ? "sent" : invoice.status,
          sent_at: new Date().toISOString(),
        })
        .eq("id", invoice.id)
        .eq("business_id", ctx.businessId);

      return {
        ok: true,
        sent_to: invoice.customer_email,
        invoice_number: invoice.number,
      };
    }

    return { ok: false, error: "unknown_tool" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "tool_failed",
    };
  }
}
