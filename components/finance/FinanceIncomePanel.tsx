"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  ChevronDown,
  Download,
  HandCoins,
  Landmark,
  PiggyBank,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FinanceTxnCompactList } from "@/components/finance/FinanceTxnCompactList";
import { ModuleListFilterChipButton } from "@/components/dashboard/module-list-search";
import { FinanceTxnExportButton } from "@/components/finance/FinanceTxnExportButton";
import { FinanceTxnDocumentField } from "@/components/finance/FinanceTxnDocumentField";
import { useStagedReceipt } from "@/components/finance/use-staged-receipt";
import {
  QuickCreateActions,
  QuickCreatePanel,
} from "@/components/ui/quick-create";
import { cn } from "@/lib/utils/cn";
import { todayMytYmd } from "@/lib/utils/today-ymd";
import type { CategoryInsight } from "@/lib/finance/helpers";
import {
  FINANCE_PAYMENT_METHODS,
  formatMyr,
  type FinanceTransactionRow,
} from "@/lib/finance/schemas";

const QUICK_AMOUNTS = [100, 500, 1000, 5000] as const;

const REVENUE_CATEGORIES = ["sales", "services"] as const;
const OTHER_IN_CATEGORIES = ["capital", "loan", "grant", "refund", "other"] as const;

const CATEGORY_META: Record<
  string,
  { label: string; emoji: string; Icon: LucideIcon; chip: string; hint?: string }
> = {
  sales: {
    label: "Sales",
    emoji: "",
    Icon: ShoppingBag,
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
  },
  services: {
    label: "Services",
    emoji: "",
    Icon: Wrench,
    chip: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-100",
  },
  invoice_payment: {
    label: "Invoice paid",
    emoji: "",
    Icon: TrendingUp,
    chip: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
  },
  capital: {
    label: "Capital",
    emoji: "",
    Icon: PiggyBank,
    chip: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100",
    hint: "Owner injection — cash in the not sales profit. Good for tracking startup funds.",
  },
  loan: {
    label: "Loan",
    emoji: "",
    Icon: Landmark,
    chip: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100",
    hint: "Borrowed money — remember to log repayments as expenses later.",
  },
  grant: {
    label: "Grant",
    emoji: "",
    Icon: HandCoins,
    chip: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
    hint: "Government grant, subsidy, or programme funding.",
  },
  refund: {
    label: "Refund",
    emoji: "",
    Icon: RotateCcw,
    chip: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100",
    hint: "Money returned from a supplier or cancelled purchase.",
  },
  other: {
    label: "Other",
    emoji: "",
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

interface FinanceIncomePanelProps {
  initialTransactions: FinanceTransactionRow[];
  monthIncomeMyr: number;
  monthLabel: string;
  incomeCount: number;
  categories: CategoryInsight[];
  shellMode?: boolean;
}

export function FinanceIncomePanel({
  initialTransactions,
  monthIncomeMyr,
  monthLabel,
  incomeCount,
  categories,
  shellMode = false,
}: FinanceIncomePanelProps) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [monthTotal, setMonthTotal] = useState(monthIncomeMyr);
  const [loggedCount, setLoggedCount] = useState(incomeCount);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("sales");
  const [counterparty, setCounterparty] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [txnDate, setTxnDate] = useState(todayMytYmd());
  const [showMore, setShowMore] = useState(false);
  const {
    adminFileId,
    adminFileName,
    stageReceipt,
    clearReceipt,
    loadReceiptFromRow,
  } = useStagedReceipt();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<string>("all");

  const refresh = useCallback(() => router.refresh(), [router]);

  const listCategories = useMemo(() => {
    const set = new Set(transactions.map((t) => t.category ?? "other"));
    return ["all", ...Array.from(set)];
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (listFilter === "all") return transactions;
    return transactions.filter((t) => (t.category ?? "other") === listFilter);
  }, [transactions, listFilter]);

  const topCategory = categories[0];
  const maxCategoryAmt = categories[0]?.amount_myr ?? 1;
  const categoryHint = categoryMeta(category).hint;

  const recentSources = useMemo(() => {
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
    setCategory("sales");
    setCounterparty("");
    setPaymentMethod("");
    setTxnDate(todayMytYmd());
    clearReceipt();
    setEditingId(null);
    setShowMore(false);
    setFormError(null);
  }, [clearReceipt]);

  const startEdit = useCallback((row: FinanceTransactionRow) => {
    setEditingId(row.id);
    setAmount(String(row.amount_myr));
    setDescription(row.description);
    setCategory(row.category ?? "other");
    setCounterparty(row.counterparty ?? "");
    setPaymentMethod(row.payment_method ?? "");
    setTxnDate(row.txn_date);
    loadReceiptFromRow(row);
    setShowMore(true);
    setFormError(null);
  }, [loadReceiptFromRow]);

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
          throw new Error("What was this income for?");
        }

        if (editingId) {
          const existing = transactions.find((t) => t.id === editingId);
          if (!existing) throw new Error("Entry not found.");
          const res = await fetch(`/api/finance/transactions/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "income",
              amount_myr: amountNum,
              description: description.trim(),
              category: category || null,
              counterparty: counterparty || null,
              payment_method: paymentMethod || null,
              txn_date: txnDate,
              admin_file_id: adminFileId,
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
                ? {
                    ...t,
                    ...json.data!,
                    admin_file_name: adminFileName,
                  }
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
            kind: "income",
            amount_myr: amountNum,
            description: description.trim(),
            category: category || null,
            counterparty: counterparty || null,
            payment_method: paymentMethod || null,
            txn_date: txnDate,
            admin_file_id: adminFileId,
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
        setTransactions((prev) => [
          { ...json.data!, admin_file_name: adminFileName },
          ...prev,
        ]);
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
      adminFileId,
      adminFileName,
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
        throw new Error(json.error?.message ?? "Could not attach file.");
      }
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...json.data! } : t)),
      );
      refresh();
    },
    [refresh],
  );

  const renderCategoryChip = (c: string) => {
    const meta = categoryMeta(c);
    const active = category === c;
    return (
      <button
        key={c}
        type="button"
        onClick={() => setCategory(c)}
        className={cn(
          "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
          active ? "border-emerald-500 bg-emerald-500 text-white" : meta.chip,
        )}
      >
        <span className="inline-flex items-center gap-1">
          <meta.Icon className="h-3 w-3 shrink-0" />
          {meta.label}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {!shellMode ? (
      <section className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-5 shadow-card dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-cyan-950/20">
        <div className="pointer-events-none absolute right-4 top-4 text-emerald-600/40 dark:text-emerald-300/20">
          <Banknote className="h-16 w-16" strokeWidth={1} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-200/80">
          {fmtMonthLabel(monthLabel)}
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink dark:text-cream-100">
          {loggedCount === 0 ? "No income logged yet" : "Money coming in"}
        </h2>
        <p className="mt-3 text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-200">
          {formatMyr(monthTotal)}
        </p>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          {loggedCount === 0
            ? "Sales, capital, loans, grants — track every ringgit in."
            : `${loggedCount} income entr${loggedCount === 1 ? "y" : "ies"} this month`}
          {topCategory
            ? ` · biggest: ${categoryMeta(topCategory.category).label} (${formatMyr(topCategory.amount_myr)})`
            : null}
        </p>
      </section>
      ) : null}

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
                    <span className="inline-flex items-center gap-1.5 font-medium text-ink dark:text-cream-100">
                      <meta.Icon className="h-3.5 w-3.5 shrink-0" />
                      {meta.label}
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
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"
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
        title={editingId ? "Edit income" : "Quick log"}
        subtitle="Amount, description, category — add proof of payment if you have one."
        icon={Banknote}
        accent="emerald"
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
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-cream-300 text-ink-muted hover:border-emerald-200 dark:border-hairline-dark dark:text-cream-400",
                )}
              >
                RM {n.toLocaleString()}
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
              className="h-12 min-w-0 flex-1 rounded-xl border border-cream-300 bg-cream-50/50 px-3 text-2xl font-bold tabular-nums text-ink focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </div>

          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was it? e.g. owner top-up, SME bank loan, cash sale…"
            required
            className="w-full rounded-lg border border-cream-300 px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              Revenue
            </p>
            <div className="flex flex-wrap gap-1.5">
              {REVENUE_CATEGORIES.map(renderCategoryChip)}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              Other money in
            </p>
            <div className="flex flex-wrap gap-1.5">
              {OTHER_IN_CATEGORIES.map(renderCategoryChip)}
            </div>
          </div>

          {categoryHint ? (
            <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              {categoryHint}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200"
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", showMore && "rotate-180")}
            />
            {showMore ? "Less options" : "Source, date & payment"}
          </button>

          {showMore ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="From / bank / investor"
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

          {recentSources.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
                Recent sources:
              </span>
              {recentSources.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCounterparty(v)}
                  className="rounded-full border border-cream-300 px-2 py-0.5 text-[11px] font-medium text-ink-muted hover:border-emerald-200 dark:border-hairline-dark dark:text-cream-400"
                >
                  {v}
                </button>
              ))}
            </div>
          ) : null}

          <FinanceTxnDocumentField
            fileId={adminFileId}
            fileName={adminFileName}
            onAttach={stageReceipt}
            label="Supporting document (optional)"
            hint="Transfer slip, loan letter, or receipt — saved with this income."
          />

          {formError ? (
            <p className="text-sm text-status-danger">{formError}</p>
          ) : null}

          <QuickCreateActions
            submitLabel={editingId ? "Update income" : "Log income"}
            loading={creating}
            onCancel={resetForm}
          />
      </QuickCreatePanel>

      <FinanceTxnCompactList
        title="Recent income"
        emptyIcon={<Download className="h-6 w-6" />}
        emptyTitle="Nothing logged yet"
        emptyHint="Invoice payments appear here automatically when customers pay."
        transactions={filteredTransactions}
        kind="income"
        categoryMeta={categoryMeta}
        busyId={busyId}
        isEditable={isEditableTxn}
        onEdit={startEdit}
        onRemove={(id, amt) => void removeTxn(id, amt)}
        onAttachReceipt={attachReceipt}
        exportMonth={monthLabel}
        exportEntryCount={loggedCount}
        filters={
          <>
            <nav
              aria-label="Filter income by category"
              className="flex flex-wrap gap-2"
            >
              {listCategories.map((cat) => (
                <ModuleListFilterChipButton
                  key={cat}
                  active={listFilter === cat}
                  accent="emerald"
                  label={cat === "all" ? "All" : categoryMeta(cat).label}
                  onClick={() => setListFilter(cat)}
                />
              ))}
            </nav>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Showing {filteredTransactions.length} entr
                {filteredTransactions.length === 1 ? "y" : "ies"}
                {listFilter !== "all"
                  ? ` · ${categoryMeta(listFilter).label}`
                  : ""}
              </p>
              <FinanceTxnExportButton
                kind="income"
                month={monthLabel}
                disabled={loggedCount === 0}
              />
            </div>
          </>
        }
      />
    </div>
  );
}
