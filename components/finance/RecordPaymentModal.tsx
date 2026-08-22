"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { FINANCE_PAYMENT_METHODS, formatMyr, type FinanceInvoiceRow } from "@/lib/finance/schemas";
import { todayMytYmd } from "@/lib/utils/today-ymd";

interface RecordPaymentModalProps {
  invoice: FinanceInvoiceRow;
  onClose: () => void;
  onSuccess: (
    invoiceId: string,
    newAmountPaid: number,
    newStatus: "partially_paid" | "paid",
  ) => void;
}

const QUICK_PCTS = [25, 50, 100] as const;

export function RecordPaymentModal({
  invoice,
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const total = Number(invoice.total_myr);
  const alreadyPaid = Number(invoice.amount_paid_myr ?? 0);
  const remaining = Math.max(0, total - alreadyPaid);

  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayMytYmd());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = parseFloat(amount);
  const willFullyPay = amountNum >= remaining - 0.005;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (amountNum > remaining + 0.005) {
      setError(`Maximum is ${formatMyr(remaining)} (remaining balance).`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/finance/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_myr: amountNum,
          payment_method: paymentMethod || null,
          payment_date: paymentDate,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { newAmountPaid: number; newStatus: "partially_paid" | "paid" };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error?.message ?? "Could not record payment.");
      }
      onSuccess(invoice.id, json.data.newAmountPaid, json.data.newStatus);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="sm">
      <ModalHeader
        title="Record payment"
        description={`${invoice.number} · ${invoice.customer_name}`}
        onClose={onClose}
      />
      <ModalBody>
        {/* Balance summary */}
        <div className="mb-4 grid grid-cols-3 divide-x divide-cream-200 rounded-xl border border-cream-200 bg-cream-50/60 text-center dark:divide-hairline-dark dark:border-hairline-dark dark:bg-hairline-dark/20">
          <div className="py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">Total</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-ink dark:text-cream-100">{formatMyr(total)}</p>
          </div>
          <div className="py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">Paid</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatMyr(alreadyPaid)}</p>
          </div>
          <div className="py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">Balance</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-rose-700 dark:text-rose-300">{formatMyr(remaining)}</p>
          </div>
        </div>

        <form id="record-payment-form" onSubmit={onSubmit} className="space-y-3">
          {/* Quick pct buttons */}
          <div className="flex gap-2">
            {QUICK_PCTS.map((pct) => {
              const v = ((remaining * pct) / 100).toFixed(2);
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setAmount(v)}
                  className="flex-1 rounded-lg border border-cream-300 py-1.5 text-xs font-semibold text-ink-muted hover:border-emerald-400 hover:text-emerald-700 dark:border-hairline-dark dark:text-cream-400 dark:hover:border-emerald-600 dark:hover:text-emerald-300"
                >
                  {pct === 100 ? "Full" : `${pct}%`}
                </button>
              );
            })}
          </div>

          {/* Amount */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-ink-muted dark:text-cream-400">RM</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="h-12 min-w-0 flex-1 rounded-xl border border-cream-300 bg-cream-50/50 px-3 text-2xl font-bold tabular-nums text-ink focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </div>

          {willFullyPay && amountNum > 0 ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
              This will mark the invoice as fully paid.
            </p>
          ) : amountNum > 0 && Number.isFinite(amountNum) ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              Balance after this payment: {formatMyr(remaining - amountNum)}
            </p>
          ) : null}

          {/* Payment method + date */}
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <option value="">Payment method</option>
              {FINANCE_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m} className="capitalize">{m}</option>
              ))}
            </select>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </div>

          {error ? (
            <p className="text-sm text-status-danger">{error}</p>
          ) : null}
        </form>
      </ModalBody>
      <ModalFooter>
        <button
          type="submit"
          form="record-payment-form"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Record payment
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-cream-300 px-4 py-2.5 text-sm font-semibold text-ink-muted hover:bg-cream-50 dark:border-hairline-dark dark:text-cream-400 dark:hover:bg-hairline-dark/40"
        >
          Cancel
        </button>
      </ModalFooter>
    </Modal>
  );
}
