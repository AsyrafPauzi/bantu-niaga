import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryInsight } from "@/lib/finance/helpers";

/** Inclusive day presets — `1` = today only. */
export const FINANCE_ANALYTICS_DAY_FILTERS = [1, 2, 3, 5, 7, 14, 30] as const;
export type FinanceAnalyticsDayFilter =
  (typeof FINANCE_ANALYTICS_DAY_FILTERS)[number];

export interface FinanceAnalyticsDayPoint {
  date: string;
  label: string;
  income_myr: number;
  expense_myr: number;
  net_myr: number;
}

export interface FinanceAnalyticsSummary {
  days: FinanceAnalyticsDayFilter | null;
  range_mode: "preset" | "custom";
  start: string;
  end: string;
  total_income_myr: number;
  total_expense_myr: number;
  net_myr: number;
  txn_count: number;
  daily: FinanceAnalyticsDayPoint[];
  income_by_category: CategoryInsight[];
  expense_by_category: CategoryInsight[];
}

const MYT = "Asia/Kuala_Lumpur";

export function todayYmdKlt(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MYT }).format(new Date());
}

function addDaysYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseYmdDate(raw?: string | null): string | null {
  if (!raw || !YMD_RE.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return raw;
}

function daysBetweenInclusive(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`).getTime();
  const b = new Date(`${end}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

export interface FinanceReportRange {
  start: string;
  end: string;
  mode: "preset" | "custom";
  days: FinanceAnalyticsDayFilter | null;
}

/** Max custom range length (days) to keep charts responsive. */
export const FINANCE_REPORT_MAX_CUSTOM_DAYS = 366;

export function parseReportDateRange(params: {
  days?: string | null;
  from?: string | null;
  to?: string | null;
}): FinanceReportRange {
  const from = parseYmdDate(params.from);
  const to = parseYmdDate(params.to);
  if (from && to && from <= to) {
    const span = daysBetweenInclusive(from, to);
    if (span <= FINANCE_REPORT_MAX_CUSTOM_DAYS) {
      return { start: from, end: to, mode: "custom", days: null };
    }
  }

  const days = parseAnalyticsDays(params.days);
  const { start, end } = analyticsDateRange(days);
  return { start, end, mode: "preset", days };
}

export function reportRangeLabel(range: FinanceReportRange): string {
  if (range.mode === "custom") {
    return formatFinancePeriodLabel(range.start, range.end);
  }
  if (range.days === 1) return "Today";
  return `Last ${range.days} days`;
}

export function parseAnalyticsDays(
  raw?: string | null,
): FinanceAnalyticsDayFilter {
  const n = Number(raw);
  if (
    FINANCE_ANALYTICS_DAY_FILTERS.includes(n as FinanceAnalyticsDayFilter)
  ) {
    return n as FinanceAnalyticsDayFilter;
  }
  return 7;
}

export function analyticsDateRange(days: FinanceAnalyticsDayFilter): {
  start: string;
  end: string;
} {
  const end = todayYmdKlt();
  const start = addDaysYmd(end, -(days - 1));
  return { start, end };
}

export function formatFinancePeriodLabel(start: string, end: string): string {
  const fmt = (ymd: string) =>
    new Date(`${ymd}T12:00:00`).toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  if (start === end) return fmt(end);
  return `${fmt(start)} – ${fmt(end)}`;
}

function shortDayLabel(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
}

function filterLabel(days: FinanceAnalyticsDayFilter | null, mode: "preset" | "custom", start: string, end: string): string {
  if (mode === "custom") return formatFinancePeriodLabel(start, end);
  if (days === 1) return "Today";
  if (days) return `${days} days`;
  return formatFinancePeriodLabel(start, end);
}

export { filterLabel as analyticsFilterLabel };

function buildDailySeries(
  start: string,
  end: string,
  buckets: Map<string, { income: number; expense: number }>,
): FinanceAnalyticsDayPoint[] {
  const out: FinanceAnalyticsDayPoint[] = [];
  let cur = start;
  while (cur <= end) {
    const b = buckets.get(cur) ?? { income: 0, expense: 0 };
    out.push({
      date: cur,
      label: shortDayLabel(cur),
      income_myr: b.income,
      expense_myr: b.expense,
      net_myr: b.income - b.expense,
    });
    cur = addDaysYmd(cur, 1);
  }
  return out;
}

export async function loadFinanceAnalyticsForRange(
  admin: SupabaseClient,
  businessId: string,
  start: string,
  end: string,
  opts?: { days?: FinanceAnalyticsDayFilter | null; mode?: "preset" | "custom" },
): Promise<FinanceAnalyticsSummary> {
  const { data } = await admin
    .from("finance_transactions")
    .select("kind, category, amount_myr, txn_date")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .gte("txn_date", start)
    .lte("txn_date", end);

  const dailyBuckets = new Map<string, { income: number; expense: number }>();
  const incomeCat = new Map<string, { amount: number; count: number }>();
  const expenseCat = new Map<string, { amount: number; count: number }>();

  let total_income_myr = 0;
  let total_expense_myr = 0;
  let txn_count = 0;

  for (const row of (data ?? []) as Array<{
    kind: string;
    category: string | null;
    amount_myr: number;
    txn_date: string;
  }>) {
    const amt = Number(row.amount_myr);
    const date = row.txn_date.slice(0, 10);
    const cat = row.category?.trim() || "other";
    txn_count += 1;

    const day = dailyBuckets.get(date) ?? { income: 0, expense: 0 };
    if (row.kind === "income") {
      day.income += amt;
      total_income_myr += amt;
      const c = incomeCat.get(cat) ?? { amount: 0, count: 0 };
      c.amount += amt;
      c.count += 1;
      incomeCat.set(cat, c);
    } else {
      day.expense += amt;
      total_expense_myr += amt;
      const c = expenseCat.get(cat) ?? { amount: 0, count: 0 };
      c.amount += amt;
      c.count += 1;
      expenseCat.set(cat, c);
    }
    dailyBuckets.set(date, day);
  }

  const toInsights = (map: Map<string, { amount: number; count: number }>) =>
    Array.from(map.entries())
      .map(([category, v]) => ({
        category,
        amount_myr: v.amount,
        count: v.count,
      }))
      .sort((a, b) => b.amount_myr - a.amount_myr);

  const mode = opts?.mode ?? (opts?.days ? "preset" : "custom");

  return {
    days: opts?.days ?? null,
    range_mode: mode,
    start,
    end,
    total_income_myr,
    total_expense_myr,
    net_myr: total_income_myr - total_expense_myr,
    txn_count,
    daily: buildDailySeries(start, end, dailyBuckets),
    income_by_category: toInsights(incomeCat),
    expense_by_category: toInsights(expenseCat),
  };
}

export async function loadFinanceAnalytics(
  admin: SupabaseClient,
  businessId: string,
  days?: FinanceAnalyticsDayFilter,
): Promise<FinanceAnalyticsSummary> {
  const rangeDays = days ?? 7;
  const { start, end } = analyticsDateRange(rangeDays);
  return loadFinanceAnalyticsForRange(admin, businessId, start, end, {
    days: rangeDays,
    mode: "preset",
  });
}
