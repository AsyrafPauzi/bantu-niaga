import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinanceMonthSummary, FinancePnLLine, FinancePnLStatement } from "@/lib/finance/schemas";
import { FINANCE_INCOME_REVENUE_CATEGORIES } from "@/lib/finance/schemas";

export function generateShareHash(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export async function nextFinanceInvoiceNumber(
  admin: SupabaseClient,
  businessId: string,
  prefix = "INV",
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;
  const { data } = await admin
    .from("finance_invoices")
    .select("number")
    .eq("business_id", businessId)
    .like("number", `${pattern}%`)
    .order("number", { ascending: false })
    .limit(1);

  const last = (data?.[0] as { number: string } | undefined)?.number;
  let seq = 1;
  if (last?.startsWith(pattern)) {
    const tail = parseInt(last.slice(pattern.length), 10);
    if (Number.isFinite(tail)) seq = tail + 1;
  }
  return `${pattern}${String(seq).padStart(4, "0")}`;
}

export async function isFinanceInvoiceNumberTaken(
  admin: SupabaseClient,
  businessId: string,
  number: string,
  excludeId?: string,
): Promise<boolean> {
  let query = admin
    .from("finance_invoices")
    .select("id")
    .eq("business_id", businessId)
    .eq("number", number)
    .is("deleted_at", null)
    .limit(1);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query;
  return (data?.length ?? 0) > 0;
}

function monthBounds(month?: string): { start: string; end: string; label: string } {
  const label = parseFinanceMonth(month);
  const [y, m] = label.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const endDate = new Date(y, m, 0);
  const end = `${y}-${String(m).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  return { start, end, label };
}

/** Current calendar month as `YYYY-MM` (never a full date). */
export function currentFinanceMonthYm(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Normalize `YYYY-MM` or `YYYY-MM-DD` query params to `YYYY-MM`. */
export function parseFinanceMonth(raw?: string | null): string {
  if (!raw) return currentFinanceMonthYm();
  const match = raw.match(/^(\d{4})-(\d{2})/);
  if (!match) return currentFinanceMonthYm();
  const monthNum = Number(match[2]);
  if (monthNum < 1 || monthNum > 12) return currentFinanceMonthYm();
  return `${match[1]}-${match[2]}`;
}

export function financeMonthBounds(month?: string): {
  start: string;
  end: string;
  label: string;
} {
  return monthBounds(month);
}

export interface CategoryInsight {
  category: string;
  amount_myr: number;
  count: number;
}

/** @deprecated Use CategoryInsight */
export type ExpenseCategoryInsight = CategoryInsight;

export async function loadExpenseMonthInsights(
  admin: SupabaseClient,
  businessId: string,
  month?: string,
): Promise<{
  categories: ExpenseCategoryInsight[];
  expenseCount: number;
  monthLabel: string;
}> {
  const { start, end, label } = monthBounds(month);

  const { data } = await admin
    .from("finance_transactions")
    .select("category, amount_myr")
    .eq("business_id", businessId)
    .eq("kind", "expense")
    .is("deleted_at", null)
    .gte("txn_date", start)
    .lte("txn_date", end);

  const map = new Map<string, { amount: number; count: number }>();
  for (const row of (data ?? []) as Array<{ category: string | null; amount_myr: number }>) {
    const cat = row.category?.trim() || "other";
    const cur = map.get(cat) ?? { amount: 0, count: 0 };
    cur.amount += Number(row.amount_myr);
    cur.count += 1;
    map.set(cat, cur);
  }

  const categories = Array.from(map.entries())
    .map(([category, v]) => ({
      category,
      amount_myr: v.amount,
      count: v.count,
    }))
    .sort((a, b) => b.amount_myr - a.amount_myr);

  return {
    categories,
    expenseCount: data?.length ?? 0,
    monthLabel: label,
  };
}

export async function loadIncomeMonthInsights(
  admin: SupabaseClient,
  businessId: string,
  month?: string,
): Promise<{
  categories: CategoryInsight[];
  incomeCount: number;
  monthLabel: string;
}> {
  const { start, end, label } = monthBounds(month);

  const { data } = await admin
    .from("finance_transactions")
    .select("category, amount_myr")
    .eq("business_id", businessId)
    .eq("kind", "income")
    .is("deleted_at", null)
    .gte("txn_date", start)
    .lte("txn_date", end);

  const map = new Map<string, { amount: number; count: number }>();
  for (const row of (data ?? []) as Array<{ category: string | null; amount_myr: number }>) {
    const cat = row.category?.trim() || "other";
    const cur = map.get(cat) ?? { amount: 0, count: 0 };
    cur.amount += Number(row.amount_myr);
    cur.count += 1;
    map.set(cat, cur);
  }

  const categories = Array.from(map.entries())
    .map(([category, v]) => ({
      category,
      amount_myr: v.amount,
      count: v.count,
    }))
    .sort((a, b) => b.amount_myr - a.amount_myr);

  return {
    categories,
    incomeCount: data?.length ?? 0,
    monthLabel: label,
  };
}

export async function computeFinanceMonthSummary(
  admin: SupabaseClient,
  businessId: string,
  month?: string,
): Promise<FinanceMonthSummary> {
  const { start, end, label } = monthBounds(month);

  const { data: txns } = await admin
    .from("finance_transactions")
    .select("kind, amount_myr")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .gte("txn_date", start)
    .lte("txn_date", end);

  let income_myr = 0;
  let expense_myr = 0;
  for (const row of (txns ?? []) as Array<{ kind: string; amount_myr: number }>) {
    const amt = Number(row.amount_myr);
    if (row.kind === "income") income_myr += amt;
    else expense_myr += amt;
  }

  const { data: invoices } = await admin
    .from("finance_invoices")
    .select("status, total_myr")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .in("status", ["sent", "paid"]);

  let invoice_paid_myr = 0;
  let invoice_outstanding_myr = 0;
  for (const inv of (invoices ?? []) as Array<{
    status: string;
    total_myr: number;
  }>) {
    const amt = Number(inv.total_myr);
    if (inv.status === "paid") invoice_paid_myr += amt;
    if (inv.status === "sent") invoice_outstanding_myr += amt;
  }

  return {
    month: label,
    income_myr,
    expense_myr,
    net_myr: income_myr - expense_myr,
    invoice_paid_myr,
    invoice_outstanding_myr,
  };
}

const REVENUE_CATEGORIES = new Set<string>(FINANCE_INCOME_REVENUE_CATEGORIES);
const EXCLUDED_FROM_PNL = new Set(["capital", "loan"]);

const PNL_CATEGORY_LABELS: Record<string, string> = {
  sales: "Sales",
  services: "Services",
  invoice_payment: "Invoice payments",
  grant: "Grants & subsidies",
  refund: "Refunds received",
  other: "Other income",
  supplies: "Supplies",
  rent: "Rent",
  utilities: "Utilities",
  salaries: "Salaries & wages",
  marketing: "Marketing",
  transport: "Transport",
  equipment: "Equipment",
  capital: "Owner capital injection",
  loan: "Loans received",
};

function pnlLabel(category: string): string {
  return (
    PNL_CATEGORY_LABELS[category] ??
    category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function toPnLLines(
  map: Map<string, { amount: number; count: number }>,
): FinancePnLLine[] {
  return Array.from(map.entries())
    .map(([category, v]) => ({
      category,
      label: pnlLabel(category),
      amount_myr: v.amount,
      count: v.count,
    }))
    .sort((a, b) => b.amount_myr - a.amount_myr);
}

function buildPnLStatement(
  start: string,
  end: string,
  periodLabel: string,
  monthKey: string,
  txns: Array<{ kind: string; category: string | null; amount_myr: number }>,
): FinancePnLStatement {
  const revenueMap = new Map<string, { amount: number; count: number }>();
  const expenseMap = new Map<string, { amount: number; count: number }>();
  const excludedMap = new Map<string, { amount: number; count: number }>();

  for (const row of txns) {
    const amt = Number(row.amount_myr);
    const cat = row.category?.trim() || "other";

    if (row.kind === "income") {
      if (EXCLUDED_FROM_PNL.has(cat)) {
        const cur = excludedMap.get(cat) ?? { amount: 0, count: 0 };
        cur.amount += amt;
        cur.count += 1;
        excludedMap.set(cat, cur);
      } else if (
        REVENUE_CATEGORIES.has(cat) ||
        cat === "grant" ||
        cat === "refund" ||
        cat === "other"
      ) {
        const cur = revenueMap.get(cat) ?? { amount: 0, count: 0 };
        cur.amount += amt;
        cur.count += 1;
        revenueMap.set(cat, cur);
      } else {
        const cur = revenueMap.get("other") ?? { amount: 0, count: 0 };
        cur.amount += amt;
        cur.count += 1;
        revenueMap.set("other", cur);
      }
    } else {
      const cur = expenseMap.get(cat) ?? { amount: 0, count: 0 };
      cur.amount += amt;
      cur.count += 1;
      expenseMap.set(cat, cur);
    }
  }

  const revenue_lines = toPnLLines(revenueMap);
  const expense_lines = toPnLLines(expenseMap);
  const excluded_cash_in = toPnLLines(excludedMap);

  const total_revenue_myr = revenue_lines.reduce((s, l) => s + l.amount_myr, 0);
  const total_expenses_myr = expense_lines.reduce((s, l) => s + l.amount_myr, 0);
  const total_excluded_cash_in_myr = excluded_cash_in.reduce(
    (s, l) => s + l.amount_myr,
    0,
  );

  return {
    period_start: start,
    period_end: end,
    period_label: periodLabel,
    month: monthKey,
    revenue_lines,
    total_revenue_myr,
    expense_lines,
    total_expenses_myr,
    net_profit_myr: total_revenue_myr - total_expenses_myr,
    excluded_cash_in,
    total_excluded_cash_in_myr,
  };
}

export async function computeFinancePnLStatementForRange(
  admin: SupabaseClient,
  businessId: string,
  start: string,
  end: string,
  periodLabel: string,
): Promise<FinancePnLStatement> {
  const { data: txns } = await admin
    .from("finance_transactions")
    .select("kind, category, amount_myr")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .gte("txn_date", start)
    .lte("txn_date", end);

  const monthKey = parseFinanceMonth(end);
  return buildPnLStatement(
    start,
    end,
    periodLabel,
    monthKey,
    (txns ?? []) as Array<{ kind: string; category: string | null; amount_myr: number }>,
  );
}

export async function computeFinanceRangeSummary(
  admin: SupabaseClient,
  businessId: string,
  start: string,
  end: string,
): Promise<{ income_myr: number; expense_myr: number; net_myr: number }> {
  const { data: txns } = await admin
    .from("finance_transactions")
    .select("kind, amount_myr")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .gte("txn_date", start)
    .lte("txn_date", end);

  let income_myr = 0;
  let expense_myr = 0;
  for (const row of (txns ?? []) as Array<{ kind: string; amount_myr: number }>) {
    const amt = Number(row.amount_myr);
    if (row.kind === "income") income_myr += amt;
    else expense_myr += amt;
  }
  return { income_myr, expense_myr, net_myr: income_myr - expense_myr };
}

export async function computeFinancePnLStatement(
  admin: SupabaseClient,
  businessId: string,
  month?: string,
): Promise<FinancePnLStatement> {
  const { start, end, label } = monthBounds(month);

  const { data: txns } = await admin
    .from("finance_transactions")
    .select("kind, category, amount_myr")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .gte("txn_date", start)
    .lte("txn_date", end);

  const periodLabel = new Date(`${start}T12:00:00`).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });

  return buildPnLStatement(
    start,
    end,
    periodLabel,
    label,
    (txns ?? []) as Array<{ kind: string; category: string | null; amount_myr: number }>,
  );
}
