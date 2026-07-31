"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Car,
  ChevronDown,
  Megaphone,
  Receipt,
  ShoppingBag,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FinanceTxnCompactList } from "@/components/finance/FinanceTxnCompactList";
import {
  QuickCreateActions,
  QuickCreatePanel,
} from "@/components/ui/quick-create";
import { cn } from "@/lib/utils/cn";
import type { ExpenseCategoryInsight } from "@/lib/finance/helpers";
import {
  FINANCE_EXPENSE_CATEGORIES,
  FINANCE_PAYMENT_METHODS,
  formatMyr,
  type FinanceTransactionRow,
} from "@/lib/finance/schemas";

const QUICK_AMOUNTS = [20, 50, 100, 200] as const;

const CATEGORY_META: Record<
  string,
  { label: string; emoji: string; Icon: LucideIcon; chip: string }
> = {
  supplies: {
    label: "Supplies",
    emoji: "🛒",
    Icon: ShoppingBag,
    chip: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
  },
  rent: {
    label: "Rent",
    emoji: "🏠",
    Icon: Receipt,
    chip: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100",
  },
  utilities: {
    label: "Utilities",
    emoji: "⚡",
    Icon: Zap,
    chip: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  },
  salaries: {
    label: "Salaries",
    emoji: "👥",
    Icon: Users,
    chip: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100",
  },
  marketing: {
    label: "Marketing",
    emoji: "📣",
    Icon: Megaphone,
    chip: "border-pink-200 bg-pink-50 text-pink-800 dark:border-pink-900 dark:bg-pink-950/40 dark:text-pink-100",
  },
  transport: {
    label: "Transport",
    emoji: "🚗",
    Icon: Car,
    chip: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-100",
  },
  equipment: {
    label: "Equipment",
    emoji: "🔧",
    Icon: Wrench,
    chip: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100",
  },
  other: {
    label: "Other",
    emoji: "✨",
    Icon: Sparkles,
    chip: "border-cream-300 bg-cream-50 text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
  },
};

function fmtMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

function categoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? CATEGORY_META.other;
}

function isEditableTxn(row: FinanceTransactionRow): boolean {
  if (row.finance_invoice_id) return false;
  if (row.description.startsWith("POS ")) return false;
  return true;
}

interface FinanceExpensesPanelProps {
  initialTransactions: FinanceTransactionRow[];
  monthExpenseMyr: number;
  monthLabel: string;
  expenseCount: number;
  categories: ExpenseCategoryInsight[];
  shellMode?: boolean;
}

export function FinanceExpensesPanel({
  initialTransactions,
  monthExpenseMyr,
  monthLabel,
  expenseCount,
  categories,
  shellMode = false,
}: FinanceExpensesPanelProps) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [monthTotal, setMonthTotal] = useState(monthExpenseMyr);
  const [loggedCount, setLoggedCount] = useState(expenseCount);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("supplies");
  const [counterparty, setCounterparty] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10));
  const [showMore, setShowMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  const topCategory = categories[0];
  const maxCategoryAmt = categories[0]?.amount_myr ?? 1;

  const recentVendors = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of transactions) {
      const v = row.counterparty?.trim();
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
      if (out.length >= 4) break;
    }
    return out;
  }, [transactions]);

  const resetForm = useCallback(() => {
    setAmount("");
    setDescription("");
    setCategory("supplies");
    setCounterparty("");
    setPaymentMethod("");
    setTxnDate(new Date().toISOString().slice(0, 10));
    setEditingId(null);
    setShowMore(false);
    setFormError(null);
  }, []);

  const startEdit = useCallback((row: FinanceTransactionRow) => {
    setEditingId(row.id);
    setAmount(String(row.amount_myr));
    setDescription(row.description);
    setCategory(row.category ?? "other");
    setCounterparty(row.counterparty ?? "");
    setPaymentMethod(row.payment_method ?? "");
    setTxnDate(row.txn_date);
    setShowMore(true);
    setFormError(null);
  }, []);

  const onSave = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setCreating(true);
      try {
        const amountNum = parseFloat(amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          throw new Error("Enter a valid amount.");
        }
        if (!description.trim()) {
          throw new Error("What did you spend on?");
        }

        if (editingId) {
          const existing = transactions.find((t) => t.id === editingId);
          if (!existing) throw new Error("Entry not found.");
          const res = await fetch(`/api/finance/transactions/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "expense",
              amount_myr: amountNum,
              description: description.trim(),
              category: category || null,
              counterparty: counterparty || null,
              payment_method: paymentMethod || null,
              txn_date: txnDate,
            }),
          });
          const json = (await res.json()) as {
            ok: boolean;
            data?: FinanceTransactionRow;
            error?: { message?: string };
          };
          if (!res.ok || !json.ok || !json.data) {
            throw new Error(json.error?.message ?? "Could not update.");
          }
          const oldAmt = Number(existing.amount_myr);
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === editingId
                ? { ...t, ...json.data!, admin_file_name: t.admin_file_name }
                : t,
            ),
          );
          setMonthTotal((m) => m - oldAmt + amountNum);
          resetForm();
          refresh();
          return;
        }

        const res = await fetch("/api/finance/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "expense",
            amount_myr: amountNum,
            description: description.trim(),
            category: category || null,
            counterparty: counterparty || null,
            payment_method: paymentMethod || null,
            txn_date: txnDate,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: FinanceTransactionRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not save.");
        }
        setTransactions((prev) => [json.data!, ...prev]);
        setMonthTotal((m) => m + amountNum);
        setLoggedCount((c) => c + 1);
        resetForm();
        refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setCreating(false);
      }
    },
    [
      amount,
      category,
      counterparty,
      description,
      editingId,
      paymentMethod,
      refresh,
      resetForm,
      transactions,
      txnDate,
    ],
  );

  const removeTxn = useCallback(
    async (id: string, amt: number) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/finance/transactions/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed.");
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        setMonthTotal((m) => m - amt);
        setLoggedCount((c) => Math.max(0, c - 1));
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const attachReceipt = useCallback(
    async (id: string, fileId: string | null) => {
      const res = await fetch(`/api/finance/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_file_id: fileId }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: FinanceTransactionRow;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error?.message ?? "Could not attach receipt.");
      }
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...json.data! } : t)),
      );
      refresh();
    },
    [refresh],
  );

  return (
    <div className="space-y-4">
      {!shellMode ? (
      <section className="relative overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 p-5 shadow-card dark:border-rose-900/40 dark:from-rose-950/40 dark:via-orange-950/20 dark:to-amber-950/20">
        <div className="pointer-events-none absolute -right-6 -top-6 text-6xl opacity-20">
          💸
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700/80 dark:text-rose-200/80">
          {fmtMonthLabel(monthLabel)}
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink dark:text-cream-100">
          {loggedCount === 0 ? "No spends logged yet" : "Where the ringgit went"}
        </h2>
        <p className="mt-3 text-3xl font-bold tabular-nums text-rose-700 dark:text-rose-200">
          {formatMyr(monthTotal)}
        </p>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          {loggedCount === 0
            ? "Log petrol, lunch, rent — keep your P&L honest."
            : `${loggedCount} expense${loggedCount === 1 ? "" : "s"} this month`}
          {topCategory
            ? ` · biggest: ${categoryMeta(topCategory.category).label} (${formatMyr(topCategory.amount_myr)})`
            : null}
        </p>
      </section>
      ) : null}

      {/* Category breakdown */}
      {categories.length > 0 ? (
        <div className="rounded-xl border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
            By category
          </p>
          <ul className="space-y-2">
            {categories.slice(0, 5).map((cat) => {
              const meta = categoryMeta(cat.category);
              const pct = Math.round((cat.amount_myr / maxCategoryAmt) * 100);
              return (
                <li key={cat.category}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-ink dark:text-cream-100">
                      {meta.emoji} {meta.label}
                      <span className="ml-1 text-xs font-normal text-ink-muted dark:text-cream-400">
                        ({cat.count})
                      </span>
                    </span>
                    <span className="tabular-nums font-semibold text-ink dark:text-cream-100">
                      {formatMyr(cat.amount_myr)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-cream-100 dark:bg-hairline-dark">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <QuickCreatePanel
        open
        onSubmit={onSave}
        title={editingId ? "Edit expense" : "Quick log"}
        subtitle="Amount → what → category. Done in seconds."
        icon={Receipt}
        accent="rose"
      >
          <div className="flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAmount(String(n))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  amount === String(n)
                    ? "border-brand-400 bg-brand-500 text-white"
                    : "border-cream-300 text-ink-muted hover:border-brand-200 dark:border-hairline-dark dark:text-cream-400",
                )}
              >
                RM {n}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-ink-muted dark:text-cream-400">
              RM
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="h-12 min-w-0 flex-1 rounded-xl border border-cream-300 bg-cream-50/50 px-3 text-2xl font-bold tabular-nums text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </div>

          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was it? e.g. Grab to client, printer ink…"
            required
            className="w-full rounded-lg border border-cream-300 px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />

          <div className="flex flex-wrap gap-1.5">
            {FINANCE_EXPENSE_CATEGORIES.map((c) => {
              const meta = categoryMeta(c);
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                    active
                      ? "border-brand-500 bg-brand-500 text-white"
                      : meta.chip,
                  )}
                >
                  {meta.emoji} {meta.label}
                </button>
              );
            })}
          </div>

          {recentVendors.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
                Recent:
              </span>
              {recentVendors.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCounterparty(v)}
                  className="rounded-full border border-cream-300 px-2 py-0.5 text-[11px] font-medium text-ink-muted hover:border-brand-200 dark:border-hairline-dark dark:text-cream-400"
                >
                  {v}
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-200"
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", showMore && "rotate-180")}
            />
            {showMore ? "Less options" : "Vendor, date & payment"}
          </button>

          {showMore ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Vendor / shop"
                className="rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              />
              <input
                type="date"
                value={txnDate}
                onChange={(e) => setTxnDate(e.target.value)}
                className="rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              />
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="rounded-lg border border-cream-300 px-3 py-2 text-sm capitalize dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              >
                <option value="">Payment method</option>
                {FINANCE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {formError ? (
            <p className="text-sm text-status-danger">{formError}</p>
          ) : null}

          <QuickCreateActions
            submitLabel={editingId ? "Update expense" : "Log expense"}
            loading={creating}
            onCancel={resetForm}
          />
      </QuickCreatePanel>

      <FinanceTxnCompactList
        title="Recent expenses"
        emptyIcon="🕵️"
        emptyTitle="Nothing logged yet"
        emptyHint="Your first expense goes above — future you will thank you at tax time."
        transactions={transactions}
        kind="expense"
        categoryMeta={categoryMeta}
        busyId={busyId}
        isEditable={isEditableTxn}
        onEdit={startEdit}
        onRemove={(id, amt) => void removeTxn(id, amt)}
        onAttachReceipt={attachReceipt}
      />
    </div>
  );
}
