"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarRange,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FinanceAnalyticsPanel } from "@/components/finance/FinanceAnalyticsPanel";
import { FinanceLedgerPanel } from "@/components/finance/FinanceLedgerPanel";
import { FinancePnLPanel } from "@/components/finance/FinancePnLPanel";
import {
  FINANCE_ANALYTICS_DAY_FILTERS,
  analyticsFilterLabel,
  formatFinancePeriodLabel,
  type FinanceAnalyticsSummary,
  type FinanceReportRange,
} from "@/lib/finance/analytics";
import type { FinancePnLStatement, FinanceTransactionRow } from "@/lib/finance/schemas";
import { formatMyr } from "@/lib/finance/schemas";

export type FinanceReportTab = "ledger" | "pnl" | "analytics";

interface FinanceReportsPanelProps {
  tab: FinanceReportTab;
  range: FinanceReportRange;
  analytics: FinanceAnalyticsSummary;
  pnl: FinancePnLStatement;
  transactions: FinanceTransactionRow[];
  businessName?: string;
}

function buildReportsUrl(
  tab: FinanceReportTab,
  range: FinanceReportRange,
): string {
  const params = new URLSearchParams({ tab });
  if (range.mode === "custom") {
    params.set("from", range.start);
    params.set("to", range.end);
  } else if (range.days) {
    params.set("days", String(range.days));
  }
  return `/finance/reports?${params.toString()}`;
}

export function FinanceReportsPanel({
  tab,
  range,
  analytics,
  pnl,
  transactions,
  businessName,
}: FinanceReportsPanelProps) {
  const router = useRouter();
  const isProfit = analytics.net_myr >= 0;
  const isCustom = range.mode === "custom";

  const [fromDate, setFromDate] = useState(range.start);
  const [toDate, setToDate] = useState(range.end);
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    setFromDate(range.start);
    setToDate(range.end);
    setRangeError(null);
  }, [range.start, range.end]);

  function navigate(nextTab: FinanceReportTab, nextRange: FinanceReportRange) {
    router.push(buildReportsUrl(nextTab, nextRange));
  }

  function setPresetDays(nextDays: number) {
    router.push(`/finance/reports?tab=${tab}&days=${nextDays}`);
  }

  function applyCustomRange(e: FormEvent) {
    e.preventDefault();
    setRangeError(null);
    if (!fromDate || !toDate) {
      setRangeError("Pick both dates.");
      return;
    }
    if (fromDate > toDate) {
      setRangeError("From date must be before to date.");
      return;
    }
    const params = new URLSearchParams({ tab, from: fromDate, to: toDate });
    router.push(`/finance/reports?${params.toString()}`);
  }

  const tabs: { id: FinanceReportTab; label: string; icon: typeof BookOpen }[] = [
    { id: "ledger", label: "Ledger", icon: BookOpen },
    { id: "pnl", label: "P&L", icon: TrendingUp },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-indigo-50 to-violet-50 p-5 shadow-card dark:border-sky-900/40 dark:from-sky-950/40 dark:via-indigo-950/20 dark:to-violet-950/20">
        <div className="pointer-events-none absolute -right-4 -top-4 text-6xl opacity-20">
          📊
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-ink dark:text-cream-100">
          Finance reports
        </h2>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          Ledger, profit &amp; loss, and analytics — {formatFinancePeriodLabel(analytics.start, analytics.end)}.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap gap-1.5">
            {FINANCE_ANALYTICS_DAY_FILTERS.map((d) => {
              const active = !isCustom && range.days === d;
              const label = d === 1 ? "Today" : `${d}d`;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPresetDays(d)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    active
                      ? "border-sky-500 bg-sky-500 text-white"
                      : "border-cream-300 bg-white/80 text-ink-muted hover:border-sky-200 dark:border-hairline-dark dark:bg-panel-dark/80 dark:text-cream-400",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <form
            onSubmit={applyCustomRange}
            className={cn(
              "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border bg-white/90 pl-2.5 pr-1 dark:bg-panel-dark/90",
              isCustom
                ? "border-indigo-400 ring-1 ring-indigo-400/30 dark:border-indigo-600"
                : "border-cream-300 dark:border-hairline-dark",
            )}
          >
            <CalendarRange
              className="h-3.5 w-3.5 shrink-0 text-ink-muted dark:text-cream-400"
              aria-hidden
            />
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
              className="h-6 min-w-0 max-w-[7.5rem] border-0 bg-transparent p-0 text-xs font-medium text-ink focus:outline-none focus:ring-0 dark:text-cream-100"
            />
            <span className="text-xs text-ink-muted dark:text-cream-400">–</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
              className="h-6 min-w-0 max-w-[7.5rem] border-0 bg-transparent p-0 text-xs font-medium text-ink focus:outline-none focus:ring-0 dark:text-cream-100"
            />
            <button
              type="submit"
              className={cn(
                "ml-0.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                isCustom
                  ? "bg-indigo-500 text-white"
                  : "bg-cream-100 text-ink hover:bg-indigo-50 dark:bg-hairline-dark dark:text-cream-100 dark:hover:bg-indigo-950/40",
              )}
            >
              Apply
            </button>
          </form>
        </div>

        {rangeError ? (
          <p className="mt-1 text-xs text-status-danger">{rangeError}</p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-emerald-200/60 bg-white/70 p-3 dark:border-emerald-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Money in
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-200">
              {formatMyr(analytics.total_income_myr)}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200/60 bg-white/70 p-3 dark:border-rose-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
              Money out
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-rose-700 dark:text-rose-200">
              {formatMyr(analytics.total_expense_myr)}
            </p>
          </div>
          <div className="rounded-xl border border-violet-200/60 bg-white/70 p-3 dark:border-violet-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
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
              {formatMyr(analytics.net_myr)}
            </p>
          </div>
        </div>

        <p className="mt-3 text-xs text-ink-muted dark:text-cream-400">
          {analytics.txn_count} transaction{analytics.txn_count === 1 ? "" : "s"} ·{" "}
          {analyticsFilterLabel(analytics.days, analytics.range_mode, analytics.start, analytics.end)}
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => navigate(id, range)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
              tab === id
                ? "border-indigo-500 bg-indigo-500 text-white"
                : "border-cream-300 bg-white text-ink-muted hover:border-indigo-200 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          <Link
            href="/finance/income"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          >
            <Wallet className="h-3.5 w-3.5" />
            Log income
          </Link>
          <Link
            href="/finance/expenses"
            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
          >
            <Receipt className="h-3.5 w-3.5" />
            Log expense
          </Link>
        </div>
      </div>

      {tab === "ledger" ? (
        <FinanceLedgerPanel
          embedded
          transactions={transactions}
          summary={{
            income_myr: analytics.total_income_myr,
            expense_myr: analytics.total_expense_myr,
            net_myr: analytics.net_myr,
          }}
          periodLabel={formatFinancePeriodLabel(analytics.start, analytics.end)}
        />
      ) : null}

      {tab === "pnl" ? (
        <FinancePnLPanel embedded statement={pnl} businessName={businessName} />
      ) : null}

      {tab === "analytics" ? (
        <FinanceAnalyticsPanel embedded data={analytics} />
      ) : null}
    </div>
  );
}
