"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarRange,
  ChevronRight,
  Download,
  Loader2,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { todayMytYmd } from "@/lib/utils/today-ymd";
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

/* ── Export helpers ───────────────────────────────────────── */
function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportLedgerCsv(transactions: FinanceTransactionRow[], periodLabel: string) {
  const headers = ["Date", "Type", "Description", "Counterparty", "Category", "Amount (RM)", "Payment method"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = transactions.map((t) => [
    t.txn_date,
    t.kind === "income" ? "Income" : "Expense",
    escape(t.description ?? ""),
    escape(t.counterparty ?? ""),
    escape((t.category ?? "").replace(/_/g, " ")),
    t.kind === "income"
      ? String(Number(t.amount_myr).toFixed(2))
      : `-${Number(t.amount_myr).toFixed(2)}`,
    escape(t.payment_method ?? ""),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9]/g, "-");
  downloadCsv(csv, `ledger-${safePeriod}.csv`);
}

function exportPnLCsv(statement: FinancePnLStatement, periodLabel: string) {
  const rows: string[] = [];
  rows.push(`"Profit & Loss Statement"`);
  rows.push(`"Period","${statement.period_label}"`);
  rows.push("");
  rows.push(`"REVENUE"`);
  statement.revenue_lines.forEach((l) =>
    rows.push(`"  ${l.label}","${Number(l.amount_myr).toFixed(2)}"`),
  );
  rows.push(`"Total Revenue","${Number(statement.total_revenue_myr).toFixed(2)}"`);
  rows.push("");
  rows.push(`"EXPENSES"`);
  statement.expense_lines.forEach((l) =>
    rows.push(`"  ${l.label}","${Number(l.amount_myr).toFixed(2)}"`),
  );
  rows.push(`"Total Expenses","${Number(statement.total_expenses_myr).toFixed(2)}"`);
  rows.push("");
  rows.push(
    `"${statement.net_profit_myr >= 0 ? "Net Profit" : "Net Loss"}","${Math.abs(Number(statement.net_profit_myr)).toFixed(2)}"`,
  );
  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9]/g, "-");
  downloadCsv(rows.join("\r\n"), `pnl-${safePeriod}.csv`);
}

export type FinanceReportTab = "ledger" | "pnl" | "analytics";

interface FinanceReportsPanelProps {
  tab: FinanceReportTab;
  range: FinanceReportRange;
  analytics: FinanceAnalyticsSummary;
  pnl: FinancePnLStatement;
  transactions: FinanceTransactionRow[];
  businessName?: string;
  shellMode?: boolean;
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
  shellMode = false,
}: FinanceReportsPanelProps) {
  const router = useRouter();
  const isProfit = analytics.net_myr >= 0;
  const isCustom = range.mode === "custom";

  const [fromDate, setFromDate] = useState(range.start);
  const [toDate, setToDate] = useState(range.end);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
      setRangeError("'From' must be before 'to'.");
      return;
    }
    const params = new URLSearchParams({ tab, from: fromDate, to: toDate });
    router.push(`/finance/reports?${params.toString()}`);
  }

  const periodLabel = formatFinancePeriodLabel(analytics.start, analytics.end);

  function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      if (tab === "ledger") {
        exportLedgerCsv(transactions, periodLabel);
      } else if (tab === "pnl") {
        exportPnLCsv(pnl, periodLabel);
      }
    } finally {
      setExporting(false);
    }
  }

  const tabs: { id: FinanceReportTab; label: string; Icon: typeof BookOpen }[] = [
    { id: "ledger",    label: "Ledger",    Icon: BookOpen },
    { id: "pnl",       label: "P&L",       Icon: TrendingUp },
    { id: "analytics", label: "Analytics", Icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      {/* ── Period & filter card ─────────────────────────────── */}
      <section
        className={cn(
          "rounded-2xl border border-sky-200/80 bg-white shadow-card dark:border-sky-900/40 dark:bg-panel-dark",
          !shellMode &&
            "relative overflow-hidden bg-gradient-to-br from-sky-50 via-indigo-50 to-violet-50 dark:from-sky-950/40 dark:via-indigo-950/20 dark:to-violet-950/20",
        )}
      >
        {/* Decorative icon (non-shell only) */}
        {!shellMode ? (
          <div className="pointer-events-none absolute right-4 top-4 text-sky-200/60 dark:text-sky-800/40">
            <BarChart3 className="h-16 w-16" strokeWidth={1} />
          </div>
        ) : null}

        <div className="p-4 sm:p-5">
          {!shellMode ? (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-ink dark:text-cream-100">
                Finance reports
              </h2>
              <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
                Ledger, profit &amp; loss, and analytics — {periodLabel}.
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              Period: {periodLabel}
            </p>
          )}

          {/* Preset day chips */}
          <div className={cn("flex flex-wrap gap-1.5", shellMode ? "mt-3" : "mt-4")}>
            {FINANCE_ANALYTICS_DAY_FILTERS.map((d) => {
              const active = !isCustom && range.days === d;
              const label = d === 1 ? "Today" : `${d}d`;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPresetDays(d)}
                  className={cn(
                    "min-h-[36px] rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
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

          {/* Custom date range — stacked on mobile, inline on sm+ */}
          <form onSubmit={applyCustomRange} className="mt-3">
            <div className={cn(
              "flex flex-col gap-2 sm:flex-row sm:items-center",
              isCustom && "ring-1 ring-indigo-400/30 rounded-xl",
            )}>
              <div className={cn(
                "flex flex-1 items-center gap-1.5 rounded-xl border bg-white/90 px-3 py-2 dark:bg-panel-dark/90",
                isCustom
                  ? "border-indigo-400 dark:border-indigo-600"
                  : "border-cream-300 dark:border-hairline-dark",
              )}>
                <CalendarRange className="h-4 w-4 shrink-0 text-ink-muted dark:text-cream-400" />
                <input
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  aria-label="From date"
                  className="min-h-[28px] min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-ink focus:outline-none focus:ring-0 dark:text-cream-100"
                />
              </div>
              <span className="hidden text-xs text-ink-muted sm:block dark:text-cream-400">–</span>
              <div className={cn(
                "flex flex-1 items-center gap-1.5 rounded-xl border bg-white/90 px-3 py-2 dark:bg-panel-dark/90",
                isCustom
                  ? "border-indigo-400 dark:border-indigo-600"
                  : "border-cream-300 dark:border-hairline-dark",
              )}>
                <CalendarRange className="h-4 w-4 shrink-0 text-ink-muted dark:text-cream-400" />
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={todayMytYmd()}
                  onChange={(e) => setToDate(e.target.value)}
                  aria-label="To date"
                  className="min-h-[28px] min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-ink focus:outline-none focus:ring-0 dark:text-cream-100"
                />
              </div>
              <button
                type="submit"
                className={cn(
                  "min-h-[40px] rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                  isCustom
                    ? "bg-indigo-500 text-white hover:bg-indigo-600"
                    : "border border-cream-300 bg-white text-ink hover:bg-indigo-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-indigo-950/40",
                )}
              >
                Apply
              </button>
            </div>
          </form>

          {rangeError ? (
            <p className="mt-1.5 text-xs text-status-danger">{rangeError}</p>
          ) : null}

          {/* Export button — visible for Ledger and P&L tabs */}
          {(tab === "ledger" || tab === "pnl") ? (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {tab === "ledger"
                  ? `${transactions.length} transaction${transactions.length === 1 ? "" : "s"} in period`
                  : `P&L · ${periodLabel}`}
              </p>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-slate-800/40"
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Export {tab === "ledger" ? "Ledger" : "P&L"} CSV
              </button>
            </div>
          ) : null}

          {/* KPI tiles — non-shell only */}
          {!shellMode ? (
            <>
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
            </>
          ) : null}
        </div>
      </section>

      {/* ── Tab switcher — full-width segmented control ──────── */}
      <div className="space-y-3">
        {/* Tab pills — equal-width grid, touch-friendly */}
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-cream-200 bg-cream-50 p-1 dark:border-hairline-dark dark:bg-panel-dark/60">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => navigate(id, range)}
              className={cn(
                "flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all",
                tab === id
                  ? "bg-white text-indigo-700 shadow-sm dark:bg-panel-dark dark:text-indigo-300"
                  : "text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden text-xs">{label}</span>
            </button>
          ))}
        </div>

        {/* Quick action shortcuts */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/finance/income"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          >
            <Wallet className="h-3.5 w-3.5" />
            Log income
          </Link>
          <Link
            href="/finance/expenses"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
          >
            <Receipt className="h-3.5 w-3.5" />
            Log expense
          </Link>
          <Link
            href="/finance"
            className="ml-auto inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink dark:text-cream-400"
          >
            Overview <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────── */}
      {tab === "ledger" ? (
        <FinanceLedgerPanel
          embedded
          transactions={transactions}
          summary={{
            income_myr: analytics.total_income_myr,
            expense_myr: analytics.total_expense_myr,
            net_myr: analytics.net_myr,
          }}
          periodLabel={periodLabel}
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
