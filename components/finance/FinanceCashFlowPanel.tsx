"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  FINANCE_EXPENSE_CATEGORIES,
  FINANCE_INCOME_CATEGORIES,
  FINANCE_PAYMENT_METHODS,
  formatMyr,
  type FinanceMonthSummary,
  type FinanceTransactionRow,
  type FinanceTxnKind,
} from "@/lib/finance/schemas";

interface FinanceCashFlowPanelProps {
  initialTransactions: FinanceTransactionRow[];
  initialSummary: FinanceMonthSummary;
  defaultKind?: FinanceTxnKind;
  title?: string;
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
}

export function FinanceCashFlowPanel({
  initialTransactions,
  initialSummary,
  defaultKind = "expense",
  title = "Cash flow",
}: FinanceCashFlowPanelProps) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [summary, setSummary] = useState(initialSummary);
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<FinanceTxnKind>(defaultKind);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  const categories =
    kind === "income" ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;

  const onCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setCreating(true);
      try {
        const amountNum = parseFloat(amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          throw new Error("Enter a valid amount.");
        }
        const res = await fetch("/api/finance/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            amount_myr: amountNum,
            description,
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
          throw new Error(json.error?.message ?? "Could not save entry.");
        }
        setTransactions((prev) => [json.data!, ...prev]);
        const delta = kind === "income" ? amountNum : -amountNum;
        setSummary((s) => ({
          ...s,
          income_myr:
            kind === "income" ? s.income_myr + amountNum : s.income_myr,
          expense_myr:
            kind === "expense" ? s.expense_myr + amountNum : s.expense_myr,
          net_myr: s.net_myr + delta,
        }));
        setAmount("");
        setDescription("");
        setCategory("");
        setCounterparty("");
        setPaymentMethod("");
        setShowForm(false);
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
      kind,
      paymentMethod,
      refresh,
      txnDate,
    ],
  );

  const removeTxn = useCallback(
    async (id: string, rowKind: FinanceTxnKind, amt: number) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/finance/transactions/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed.");
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        setSummary((s) => ({
          ...s,
          income_myr:
            rowKind === "income" ? s.income_myr - amt : s.income_myr,
          expense_myr:
            rowKind === "expense" ? s.expense_myr - amt : s.expense_myr,
          net_myr: s.net_myr + (rowKind === "income" ? -amt : amt),
        }));
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-cream-200 bg-white p-3 dark:border-hairline-dark dark:bg-panel-dark">
          <p className="text-xs text-ink-muted dark:text-cream-400">Income</p>
          <p className="text-lg font-semibold text-status-success">
            {formatMyr(summary.income_myr)}
          </p>
        </div>
        <div className="rounded-lg border border-cream-200 bg-white p-3 dark:border-hairline-dark dark:bg-panel-dark">
          <p className="text-xs text-ink-muted dark:text-cream-400">Expenses</p>
          <p className="text-lg font-semibold text-status-danger">
            {formatMyr(summary.expense_myr)}
          </p>
        </div>
        <div className="rounded-lg border border-cream-200 bg-white p-3 dark:border-hairline-dark dark:bg-panel-dark">
          <p className="text-xs text-ink-muted dark:text-cream-400">Net (P&L)</p>
          <p
            className={cn(
              "text-lg font-semibold",
              summary.net_myr >= 0
                ? "text-status-success"
                : "text-status-danger",
            )}
          >
            {formatMyr(summary.net_myr)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setKind("income");
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-status-success/90 px-3 py-2 text-sm font-semibold text-white hover:bg-status-success"
        >
          <Plus className="h-4 w-4" />
          Log income
        </button>
        <button
          type="button"
          onClick={() => {
            setKind("expense");
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" />
          Log expense
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={onCreate}
          className="space-y-3 rounded-lg border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark"
        >
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            New {kind === "income" ? "income" : "expense"} · {title}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (MYR)"
              required
              className="rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
            <input
              type="date"
              value={txnDate}
              onChange={(e) => setTxnDate(e.target.value)}
              className="rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was this for?"
            required
            className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-cream-300 px-3 py-2 text-sm capitalize dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <option value="">Category (optional)</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <option value="">Payment method</option>
              {FINANCE_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder={kind === "income" ? "Customer / source" : "Vendor"}
            className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          {formError ? (
            <p className="text-sm text-status-danger">{formError}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:border-hairline-dark dark:text-cream-400"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {transactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-cream-300 py-10 text-center dark:border-hairline-dark">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            No entries yet — log your first income or expense above.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-cream-200 rounded-lg border border-cream-200 bg-white dark:divide-hairline-dark dark:border-hairline-dark dark:bg-panel-dark">
          {transactions.map((row) => {
            const isIncome = row.kind === "income";
            const busy = busyId === row.id;
            const amt = Number(row.amount_myr);
            return (
              <li key={row.id} className="flex items-start gap-3 p-4">
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    isIncome
                      ? "bg-status-success/10 text-status-success"
                      : "bg-status-danger/10 text-status-danger",
                  )}
                >
                  {isIncome ? (
                    <ArrowDownRight className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink dark:text-cream-100">
                    {row.description}
                  </p>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    {fmtDate(row.txn_date)}
                    {row.counterparty ? ` · ${row.counterparty}` : ""}
                    {row.category ? ` · ${row.category.replace(/_/g, " ")}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "font-semibold tabular-nums",
                      isIncome ? "text-status-success" : "text-status-danger",
                    )}
                  >
                    {isIncome ? "+" : "−"}
                    {formatMyr(amt)}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeTxn(row.id, row.kind, amt)}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-ink-muted hover:text-status-danger dark:text-cream-400"
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
