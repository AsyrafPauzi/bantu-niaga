"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Receipt,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  formatMyr,
  type FinanceMonthSummary,
  type FinanceTransactionRow,
} from "@/lib/finance/schemas";

type LedgerFilter = "all" | "income" | "expense";

const CATEGORY_EMOJI: Record<string, string> = {
  sales: "🛍️",
  services: "🛠️",
  invoice_payment: "📄",
  capital: "💰",
  loan: "🏦",
  grant: "🎁",
  refund: "↩️",
  supplies: "🛒",
  rent: "🏠",
  utilities: "⚡",
  salaries: "👥",
  marketing: "📣",
  transport: "🚗",
  equipment: "🔧",
  other: "✨",
};

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
}

function fmtMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

function categoryLabel(cat: string | null): string {
  if (!cat) return "Other";
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface FinanceLedgerPanelProps {
  transactions: FinanceTransactionRow[];
  summary: Pick<FinanceMonthSummary, "income_myr" | "expense_myr" | "net_myr">;
  month?: string;
  embedded?: boolean;
  periodLabel?: string;
}

export function FinanceLedgerPanel({
  transactions,
  summary,
  month,
  embedded = false,
  periodLabel,
}: FinanceLedgerPanelProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<LedgerFilter>("all");

  const filteredTxns = useMemo(() => {
    if (filter === "all") return transactions;
    return transactions.filter((t) => t.kind === filter);
  }, [filter, transactions]);

  function onMonthChange(next: string) {
    if (!next) return;
    router.push(`/finance/ledger?month=${next}`);
  }

  return (
    <div className="space-y-4">
      {!embedded ? (
      <section className="relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-indigo-50 to-violet-50 p-5 shadow-card dark:border-sky-900/40 dark:from-sky-950/40 dark:via-indigo-950/20 dark:to-violet-950/20">
        <div className="pointer-events-none absolute -right-4 -top-4 text-6xl opacity-20">
          📒
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700/80 dark:text-sky-200/80">
              {month ? fmtMonthLabel(month) : periodLabel}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink dark:text-cream-100">
              Cash flow ledger
            </h2>
            <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
              Every ringgit in and out — from your real transactions.
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
              <Link
                href="/finance/reports?tab=analytics"
                className="text-indigo-700 hover:text-indigo-800 dark:text-indigo-300"
              >
                Reports →
              </Link>
            </div>
          </div>
          {month ? (
          <label className="inline-flex items-center gap-2 rounded-xl border border-cream-300 bg-white/80 px-3 py-2 text-sm shadow-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <Calendar className="h-4 w-4 text-ink-muted dark:text-cream-400" />
            <input
              type="month"
              value={month}
              onChange={(e) => onMonthChange(e.target.value)}
              className="border-0 bg-transparent p-0 text-sm font-medium text-ink focus:outline-none dark:text-cream-100"
              aria-label="Select month"
            />
          </label>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-emerald-200/60 bg-white/70 p-3 dark:border-emerald-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Money in
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-200">
              {formatMyr(summary.income_myr)}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200/60 bg-white/70 p-3 dark:border-rose-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
              Money out
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-rose-700 dark:text-rose-200">
              {formatMyr(summary.expense_myr)}
            </p>
          </div>
          <div className="rounded-xl border border-violet-200/60 bg-white/70 p-3 dark:border-violet-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Net
            </p>
            <p
              className={cn(
                "mt-1 text-lg font-bold tabular-nums",
                summary.net_myr >= 0
                  ? "text-emerald-700 dark:text-emerald-200"
                  : "text-rose-700 dark:text-rose-200",
              )}
            >
              {formatMyr(summary.net_myr)}
            </p>
          </div>
        </div>
      </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All"],
            ["income", "Money in"],
            ["expense", "Money out"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              filter === key
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-cream-300 text-ink-muted hover:border-brand-200 dark:border-hairline-dark dark:text-cream-400",
            )}
          >
            {label}
          </button>
        ))}
        {!embedded ? (
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
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-cream-200 bg-white dark:border-hairline-dark dark:bg-panel-dark">
        <div className="border-b border-cream-200 px-4 py-2.5 dark:border-hairline-dark">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
            {filter === "all"
              ? "All entries"
              : filter === "income"
                ? "Money in"
                : "Money out"}
            <span className="ml-1 font-normal">({filteredTxns.length})</span>
          </p>
        </div>

        {filteredTxns.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-3xl">🧾</p>
            <p className="mt-2 text-sm font-medium text-ink dark:text-cream-100">
              No entries in this period
            </p>
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
              Log income or expenses — invoice & POS payments appear here automatically.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-cream-100 dark:divide-hairline-dark">
            {filteredTxns.map((row) => {
              const isIncome = row.kind === "income";
              const emoji = CATEGORY_EMOJI[row.category ?? "other"] ?? "✨";
              const auto =
                Boolean(row.finance_invoice_id) ||
                row.description.startsWith("POS ");
              return (
                <li
                  key={row.id}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-cream-50/80 dark:hover:bg-panel-dark/60"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base",
                      isIncome
                        ? "border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                        : "border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40",
                    )}
                  >
                    {emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink dark:text-cream-100">
                      {row.description}
                    </p>
                    <p className="text-xs text-ink-muted dark:text-cream-400">
                      {fmtDate(row.txn_date)}
                      {row.counterparty ? ` · ${row.counterparty}` : ""}
                      {row.category ? ` · ${categoryLabel(row.category)}` : ""}
                      {auto ? " · auto" : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "font-semibold tabular-nums",
                        isIncome
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-rose-700 dark:text-rose-300",
                      )}
                    >
                      {isIncome ? "+" : "−"}
                      {formatMyr(Number(row.amount_myr))}
                    </p>
                    <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-ink-muted dark:text-cream-400">
                      {isIncome ? (
                        <ArrowDownRight className="h-3 w-3" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                      {isIncome ? "in" : "out"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
