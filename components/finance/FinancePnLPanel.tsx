"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Download, Loader2, Printer } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { downloadAccountantExportPack } from "@/components/finance/AccountantExportButton";
import {
  formatMyr,
  type FinancePnLLine,
  type FinancePnLStatement,
} from "@/lib/finance/schemas";

function fmtPeriodEnd(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StatementRow({
  label,
  amount,
  indent = false,
  bold = false,
  tone,
}: {
  label: string;
  amount: number;
  indent?: boolean;
  bold?: boolean;
  tone?: "profit" | "loss";
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-1.5",
        indent && "pl-4",
        bold && "font-semibold",
      )}
    >
      <span className={cn("text-sm", bold ? "text-ink dark:text-cream-100" : "text-ink-muted dark:text-cream-400")}>
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 tabular-nums text-sm",
          bold && tone === "profit" && "text-emerald-700 dark:text-emerald-300",
          bold && tone === "loss" && "text-rose-700 dark:text-rose-300",
          bold && !tone && "text-ink dark:text-cream-100",
          !bold && "text-ink dark:text-cream-100",
        )}
      >
        {formatMyr(amount)}
      </span>
    </div>
  );
}

function SectionLines({ lines }: { lines: FinancePnLLine[] }) {
  if (lines.length === 0) {
    return (
      <p className="py-2 pl-4 text-sm italic text-ink-muted dark:text-cream-400">
        None recorded
      </p>
    );
  }
  return (
    <>
      {lines.map((line) => (
        <StatementRow
          key={line.category}
          label={line.label}
          amount={line.amount_myr}
          indent
        />
      ))}
    </>
  );
}

interface FinancePnLPanelProps {
  statement: FinancePnLStatement;
  businessName?: string;
  embedded?: boolean;
}

export function FinancePnLPanel({
  statement,
  businessName,
  embedded = false,
}: FinancePnLPanelProps) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const isProfit = statement.net_profit_myr >= 0;

  function onMonthChange(next: string) {
    if (!next) return;
    router.push(`/finance/reports?tab=pnl&days=30&month=${next}`);
  }

  const periodSubtitle =
    statement.period_start === statement.period_end
      ? `For ${fmtPeriodEnd(statement.period_end)}`
      : `For the period ${statement.period_label}`;

  async function onExport() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadAccountantExportPack(statement.month);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {!embedded ? (
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/finance/reports?tab=ledger"
            className="rounded-full border border-cream-300 px-3 py-1 text-xs font-semibold text-ink-muted hover:border-brand-200 dark:border-hairline-dark dark:text-cream-400"
          >
            ← Reports
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark">
            <Calendar className="h-4 w-4 text-ink-muted dark:text-cream-400" />
            <input
              type="month"
              value={statement.month}
              onChange={(e) => onMonthChange(e.target.value)}
              className="border-0 bg-transparent p-0 text-sm font-medium text-ink focus:outline-none dark:text-cream-100"
              aria-label="Select month"
            />
          </label>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cream-300 px-3 py-2 text-xs font-semibold text-ink-muted hover:bg-cream-50 dark:border-hairline-dark dark:text-cream-400 dark:hover:bg-panel-dark"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
          <button
            type="button"
            onClick={() => void onExport()}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export CSV
          </button>
        </div>
      </div>
      ) : (
      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-cream-300 px-3 py-2 text-xs font-semibold text-ink-muted hover:bg-cream-50 dark:border-hairline-dark dark:text-cream-400 dark:hover:bg-panel-dark"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
        <button
          type="button"
          onClick={() => void onExport()}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export CSV
        </button>
      </div>
      )}

      {exportError ? (
        <p className="text-sm text-status-danger print:hidden">{exportError}</p>
      ) : null}

      <article className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-card print:max-w-none print:rounded-none print:border-0 print:shadow-none dark:border-hairline-dark dark:bg-panel-dark">
        <header className="border-b border-cream-200 bg-cream-50/80 px-6 py-8 text-center dark:border-hairline-dark dark:bg-panel-dark/80">
          {businessName ? (
            <p className="text-sm font-semibold uppercase tracking-widest text-ink-muted dark:text-cream-400">
              {businessName}
            </p>
          ) : null}
          <h1 className="mt-2 text-xl font-bold uppercase tracking-wide text-ink dark:text-cream-100">
            Profit &amp; Loss Statement
          </h1>
          <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
            {periodSubtitle}
          </p>
        </header>

        <div className="px-6 py-6 font-mono text-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink dark:text-cream-100">
            Revenue
          </p>
          <SectionLines lines={statement.revenue_lines} />
          <div className="my-2 border-t border-dashed border-cream-300 dark:border-hairline-dark" />
          <StatementRow
            label="Total revenue"
            amount={statement.total_revenue_myr}
            bold
          />

          <p className="mb-2 mt-8 text-xs font-bold uppercase tracking-wider text-ink dark:text-cream-100">
            Less: Expenses
          </p>
          <SectionLines lines={statement.expense_lines} />
          <div className="my-2 border-t border-dashed border-cream-300 dark:border-hairline-dark" />
          <StatementRow
            label="Total expenses"
            amount={statement.total_expenses_myr}
            bold
          />

          <div className="my-4 border-t-2 border-ink/20 dark:border-cream-100/20" />
          <StatementRow
            label={isProfit ? "Net profit" : "Net loss"}
            amount={Math.abs(statement.net_profit_myr)}
            bold
            tone={isProfit ? "profit" : "loss"}
          />
        </div>

        {statement.excluded_cash_in.length > 0 ? (
          <footer className="border-t border-cream-200 bg-amber-50/50 px-6 py-4 dark:border-hairline-dark dark:bg-amber-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Not included in P&amp;L
            </p>
            <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-100/80">
              Capital and loans are cash in the bank, not business revenue.
            </p>
            <div className="mt-3 space-y-1">
              {statement.excluded_cash_in.map((line) => (
                <div
                  key={line.category}
                  className="flex justify-between gap-4 text-xs text-amber-900 dark:text-amber-100"
                >
                  <span>{line.label}</span>
                  <span className="tabular-nums font-medium">
                    {formatMyr(line.amount_myr)}
                  </span>
                </div>
              ))}
            </div>
          </footer>
        ) : null}
      </article>

      <p className="mx-auto max-w-2xl text-center text-xs text-ink-muted print:hidden dark:text-cream-400">
        Based on logged transactions. Invoice payments and POS sales count as revenue
        automatically.
      </p>
    </div>
  );
}
