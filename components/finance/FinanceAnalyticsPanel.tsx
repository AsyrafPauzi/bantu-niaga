"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useChartMount } from "@/components/marketing/dashboard/use-chart-mount";
import {
  FINANCE_ANALYTICS_DAY_FILTERS,
  analyticsFilterLabel,
  type FinanceAnalyticsSummary,
} from "@/lib/finance/analytics";
import type { CategoryInsight } from "@/lib/finance/helpers";
import { formatMyr } from "@/lib/finance/schemas";

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Sales",
  services: "Services",
  invoice_payment: "Invoices",
  capital: "Capital",
  loan: "Loans",
  grant: "Grants",
  refund: "Refunds",
  supplies: "Supplies",
  rent: "Rent",
  utilities: "Utilities",
  salaries: "Salaries",
  marketing: "Marketing",
  transport: "Transport",
  equipment: "Equipment",
  other: "Other",
};

function catLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat.replace(/_/g, " ");
}

function CategoryList({
  items,
  tone,
}: {
  items: CategoryInsight[];
  tone: "income" | "expense";
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-ink-muted dark:text-cream-400">Nothing logged yet.</p>
    );
  }
  const max = items[0]?.amount_myr ?? 1;
  return (
    <ul className="space-y-2">
      {items.slice(0, 6).map((item) => {
        const pct = Math.round((item.amount_myr / max) * 100);
        return (
          <li key={item.category}>
            <div className="mb-1 flex justify-between gap-2 text-sm">
              <span className="text-ink dark:text-cream-100">{catLabel(item.category)}</span>
              <span className="tabular-nums font-semibold text-ink dark:text-cream-100">
                {formatMyr(item.amount_myr)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-cream-100 dark:bg-hairline-dark">
              <div
                className={cn(
                  "h-full rounded-full",
                  tone === "income"
                    ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                    : "bg-gradient-to-r from-rose-400 to-orange-400",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface FinanceAnalyticsPanelProps {
  data: FinanceAnalyticsSummary;
  embedded?: boolean;
}

export function FinanceAnalyticsPanel({ data, embedded = false }: FinanceAnalyticsPanelProps) {
  const router = useRouter();
  const mounted = useChartMount();
  const isProfit = data.net_myr >= 0;
  const hasActivity = data.txn_count > 0;

  function setDays(days: number) {
    router.push(`/finance/reports?tab=analytics&days=${days}`);
  }

  const chartData = data.daily.map((d) => ({
    ...d,
    income: d.income_myr,
    expense: d.expense_myr,
  }));

  const chartSpan = data.daily.length;

  return (
    <div className="space-y-4">
      {!embedded ? (
      <section className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 p-5 shadow-card dark:border-indigo-900/40 dark:from-indigo-950/40 dark:via-violet-950/20 dark:to-fuchsia-950/20">
        <div className="pointer-events-none absolute -right-4 -top-4 text-indigo-200/50 dark:text-indigo-800/30">
          <BarChart3 className="h-20 w-20" strokeWidth={1} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-ink dark:text-cream-100">
          Financial analytics
        </h2>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          Money in, money out, and net — {analyticsFilterLabel(data.days, data.range_mode, data.start, data.end).toLowerCase()}.
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {FINANCE_ANALYTICS_DAY_FILTERS.map((d) => {
            const active = data.range_mode === "preset" && data.days === d;
            const label = d === 1 ? "Today" : `${d}d`;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : "border-cream-300 bg-white/80 text-ink-muted hover:border-indigo-200 dark:border-hairline-dark dark:bg-panel-dark/80 dark:text-cream-400",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-emerald-200/60 bg-white/70 p-3 dark:border-emerald-900/40 dark:bg-panel-dark/60">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              <ArrowDownRight className="h-3 w-3" />
              In
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-200">
              {formatMyr(data.total_income_myr)}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200/60 bg-white/70 p-3 dark:border-rose-900/40 dark:bg-panel-dark/60">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
              <ArrowUpRight className="h-3 w-3" />
              Out
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-rose-700 dark:text-rose-200">
              {formatMyr(data.total_expense_myr)}
            </p>
          </div>
          <div className="rounded-xl border border-violet-200/60 bg-white/70 p-3 dark:border-violet-900/40 dark:bg-panel-dark/60">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              {isProfit ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              Net
            </p>
            <p
              className={cn(
                "mt-1 text-lg font-bold tabular-nums",
                isProfit
                  ? "text-emerald-700 dark:text-emerald-200"
                  : "text-rose-700 dark:text-rose-200",
              )}
            >
              {formatMyr(data.net_myr)}
            </p>
          </div>
        </div>

        <p className="mt-3 text-xs text-ink-muted dark:text-cream-400">
          {data.txn_count} transaction{data.txn_count === 1 ? "" : "s"} ·{" "}
          <Link
            href="/finance/pnl"
            className="font-semibold text-indigo-700 dark:text-indigo-300"
          >
            P&amp;L statement →
          </Link>
        </p>
      </section>
      ) : null}

      <div className="rounded-xl border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
          Daily cash flow
        </p>
        {!hasActivity ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-cream-300 dark:border-hairline-dark">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-cream-200 bg-cream-50 text-ink-muted dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400">
              <TrendingUp className="h-6 w-6" />
            </span>
            <p className="text-sm text-ink-muted dark:text-cream-400">
              No transactions in this period.
            </p>
          </div>
        ) : !mounted ? (
          <div className="h-56 w-full" aria-hidden="true" />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-cream-200 dark:stroke-hairline-dark" />
                <XAxis
                  dataKey="label"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={chartSpan <= 14 ? 0 : "preserveStartEnd"}
                />
                <YAxis fontSize={10} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  formatter={(value) => formatMyr(Number(value))}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { date?: string } | undefined;
                    return row?.date ?? "";
                  }}
                  contentStyle={{
                    borderRadius: 8,
                    fontSize: 12,
                    border: "1px solid var(--cream-200, #e8e4dc)",
                  }}
                />
                <Legend
                  formatter={(value) => (value === "income" ? "Money in" : "Money out")}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="income" name="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Income by category
          </p>
          <CategoryList items={data.income_by_category} tone="income" />
        </div>
        <div className="rounded-xl border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
            Expenses by category
          </p>
          <CategoryList items={data.expense_by_category} tone="expense" />
        </div>
      </div>
    </div>
  );
}
