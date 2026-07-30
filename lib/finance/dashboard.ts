import type { SupabaseClient } from "@supabase/supabase-js";
import { computeFinanceMonthSummary } from "@/lib/finance/helpers";
import type { FinanceMonthSummary } from "@/lib/finance/schemas";
import { malaysiaDayBounds, malaysiaTodayYmd } from "@/lib/sales/schemas";

export interface FinanceDashboardTxn {
  id: string;
  kind: "income" | "expense";
  description: string;
  amount_myr: number;
  txn_date: string;
  counterparty: string | null;
}

export interface FinanceDashboardInvoice {
  id: string;
  number: string;
  customer_name: string;
  status: string;
  total_myr: number;
  document_kind: "invoice" | "quote";
  due_date: string | null;
  invoice_date: string;
}

export interface FinanceChaseInvoice {
  id: string;
  number: string;
  customer_name: string;
  customer_phone: string | null;
  total_myr: number;
  due_date: string | null;
  share_hash: string;
  is_overdue: boolean;
}

export interface FinanceExpenseCategory {
  category: string;
  amount_myr: number;
  pct: number;
}

export interface FinanceMonthComparison {
  income_pct: number | null;
  expense_pct: number | null;
  net_pct: number | null;
  prev_month_label: string;
}

export interface FinancePosToday {
  sales_count: number;
  sales_total_myr: number;
}

export interface FinanceDashboardData {
  month: string;
  summary: FinanceMonthSummary;
  prevSummary: FinanceMonthSummary;
  comparison: FinanceMonthComparison;
  monthLabel: string;
  recentTransactions: FinanceDashboardTxn[];
  recentInvoices: FinanceDashboardInvoice[];
  chaseList: FinanceChaseInvoice[];
  expenseCategories: FinanceExpenseCategory[];
  posToday: FinancePosToday;
  counts: {
    customers: number;
    draftInvoices: number;
    sentInvoices: number;
    overdueInvoices: number;
    openQuotes: number;
    paidThisMonth: number;
  };
  expenseRatioPct: number | null;
  idcompany: string;
  appUrl: string;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

function formatMonthShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "short" });
}

function currentMonthYm(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function prevMonthYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function parseMonthParam(month?: string): string {
  if (month && /^\d{4}-\d{2}$/.test(month)) return month;
  return currentMonthYm();
}

export async function loadFinanceDashboard(
  supabase: SupabaseClient,
  businessId: string,
  opts?: { month?: string; idcompany?: string; appUrl?: string },
): Promise<FinanceDashboardData> {
  const month = parseMonthParam(opts?.month);
  const prevMonth = prevMonthYm(month);
  const today = malaysiaTodayYmd();
  const { dayStartIso, dayEndIso } = malaysiaDayBounds(today);

  const [summary, prevSummary] = await Promise.all([
    computeFinanceMonthSummary(supabase, businessId, month),
    computeFinanceMonthSummary(supabase, businessId, prevMonth),
  ]);

  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const monthEndDate = new Date(y, m, 0);
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(monthEndDate.getDate()).padStart(2, "0")}`;

  const [
    recentTxnsRes,
    recentInvoicesRes,
    chaseRes,
    expenseTxnsRes,
    customersRes,
    draftRes,
    sentRes,
    overdueRes,
    quotesRes,
    paidMonthRes,
    posTodayRes,
  ] = await Promise.all([
    supabase
      .from("finance_transactions")
      .select("id, kind, description, amount_myr, txn_date, counterparty")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("txn_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("finance_invoices")
      .select(
        "id, number, customer_name, status, total_myr, document_kind, due_date, invoice_date",
      )
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("finance_invoices")
      .select(
        "id, number, customer_name, customer_phone, total_myr, due_date, share_hash, status",
      )
      .eq("business_id", businessId)
      .eq("document_kind", "invoice")
      .eq("status", "sent")
      .is("deleted_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("finance_transactions")
      .select("category, amount_myr")
      .eq("business_id", businessId)
      .eq("kind", "expense")
      .is("deleted_at", null)
      .gte("txn_date", monthStart)
      .lte("txn_date", monthEnd),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("deleted_at", null),
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("document_kind", "invoice")
      .eq("status", "draft")
      .is("deleted_at", null),
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("document_kind", "invoice")
      .eq("status", "sent")
      .is("deleted_at", null),
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("document_kind", "invoice")
      .eq("status", "sent")
      .lt("due_date", today)
      .is("deleted_at", null),
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("document_kind", "quote")
      .in("status", ["draft", "sent"])
      .is("deleted_at", null),
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("document_kind", "invoice")
      .eq("status", "paid")
      .gte("paid_at", `${month}-01T00:00:00+08:00`)
      .is("deleted_at", null),
    supabase
      .from("pos_sales")
      .select("id, total_myr")
      .eq("business_id", businessId)
      .gte("created_at", dayStartIso)
      .lt("created_at", dayEndIso),
  ]);

  const categoryMap = new Map<string, number>();
  for (const row of expenseTxnsRes.data ?? []) {
    const key =
      (row.category as string | null)?.trim() || "uncategorized";
    const label = key === "uncategorized" ? "Uncategorized" : key.replace(/_/g, " ");
    categoryMap.set(label, (categoryMap.get(label) ?? 0) + Number(row.amount_myr));
  }
  const expenseTotal = [...categoryMap.values()].reduce((a, b) => a + b, 0);
  const expenseCategories: FinanceExpenseCategory[] = [...categoryMap.entries()]
    .map(([category, amount_myr]) => ({
      category,
      amount_myr,
      pct: expenseTotal > 0 ? Math.round((amount_myr / expenseTotal) * 100) : 0,
    }))
    .sort((a, b) => b.amount_myr - a.amount_myr)
    .slice(0, 5);

  const posRows = posTodayRes.data ?? [];
  const posToday: FinancePosToday = {
    sales_count: posRows.length,
    sales_total_myr: posRows.reduce(
      (sum, r) => sum + Number(r.total_myr ?? 0),
      0,
    ),
  };

  const totalFlow = summary.income_myr + summary.expense_myr;
  const expenseRatioPct =
    totalFlow > 0
      ? Math.round((summary.expense_myr / totalFlow) * 100)
      : null;

  return {
    month,
    summary,
    prevSummary,
    comparison: {
      income_pct: pctChange(summary.income_myr, prevSummary.income_myr),
      expense_pct: pctChange(summary.expense_myr, prevSummary.expense_myr),
      net_pct: pctChange(summary.net_myr, prevSummary.net_myr),
      prev_month_label: formatMonthShort(prevMonth),
    },
    monthLabel: formatMonthLabel(month),
    recentTransactions: (recentTxnsRes.data ?? []).map((row) => ({
      id: row.id as string,
      kind: row.kind as "income" | "expense",
      description: row.description as string,
      amount_myr: Number(row.amount_myr),
      txn_date: row.txn_date as string,
      counterparty: (row.counterparty as string | null) ?? null,
    })),
    recentInvoices: (recentInvoicesRes.data ?? []).map((row) => ({
      id: row.id as string,
      number: row.number as string,
      customer_name: row.customer_name as string,
      status: row.status as string,
      total_myr: Number(row.total_myr),
      document_kind: row.document_kind as "invoice" | "quote",
      due_date: (row.due_date as string | null) ?? null,
      invoice_date: row.invoice_date as string,
    })),
    chaseList: (chaseRes.data ?? []).map((row) => {
      const due = row.due_date as string | null;
      return {
        id: row.id as string,
        number: row.number as string,
        customer_name: row.customer_name as string,
        customer_phone: (row.customer_phone as string | null) ?? null,
        total_myr: Number(row.total_myr),
        due_date: due,
        share_hash: row.share_hash as string,
        is_overdue: Boolean(due && due < today),
      };
    }),
    expenseCategories,
    posToday,
    counts: {
      customers: customersRes.count ?? 0,
      draftInvoices: draftRes.count ?? 0,
      sentInvoices: sentRes.count ?? 0,
      overdueInvoices: overdueRes.count ?? 0,
      openQuotes: quotesRes.count ?? 0,
      paidThisMonth: paidMonthRes.count ?? 0,
    },
    expenseRatioPct,
    idcompany: opts?.idcompany ?? "",
    appUrl: opts?.appUrl ?? "",
  };
}
