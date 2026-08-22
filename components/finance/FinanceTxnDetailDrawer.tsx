"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  Calendar,
  CreditCard,
  FileText,
  Paperclip,
  Tag,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { formatMyr, type FinanceTransactionRow } from "@/lib/finance/schemas";

interface DetailRowProps {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}

function DetailRow({ icon, label, children }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cream-200 bg-cream-50 text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/40 dark:text-cream-400">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
          {label}
        </p>
        <div className="mt-0.5 text-sm text-ink dark:text-cream-100">{children}</div>
      </div>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentMethodLabel(m: string | null): string {
  if (!m) return "—";
  const map: Record<string, string> = {
    cash: "Cash",
    duitnow: "DuitNow",
    bank: "Bank transfer",
    card: "Card",
    other: "Other",
    duitnow_qr: "DuitNow QR",
    duitnow_transfer: "DuitNow Transfer",
    gateway: "Payment gateway",
    fpx: "FPX",
  };
  return map[m] ?? m;
}

function categoryLabel(cat: string | null): string {
  const map: Record<string, string> = {
    sales: "Sales",
    services: "Services",
    invoice_payment: "Invoice payment",
    capital: "Capital injection",
    loan: "Loan",
    grant: "Grant",
    refund: "Refund",
    other: "Other",
    supplies: "Supplies",
    salary: "Salary",
    utilities: "Utilities",
    marketing: "Marketing",
    software: "Software",
    transport: "Transport",
    booking_payment: "Booking payment",
    order_payment: "Order payment",
  };
  return cat ? (map[cat] ?? cat) : "—";
}

function detectSource(row: FinanceTransactionRow): {
  label: string;
  href: string | null;
  badge: string;
} | null {
  if (row.description.startsWith("POS ")) {
    return { label: "POS sale", href: "/sales/history", badge: "POS · auto" };
  }
  if (row.finance_invoice_id) {
    return {
      label: "Invoice",
      href: `/finance/invoices/${row.finance_invoice_id}`,
      badge: "Invoice · auto",
    };
  }
  if (row.operations_booking_id) {
    return {
      label: "Booking completed",
      href: "/operations/bookings",
      badge: "Booking · auto",
    };
  }
  if (row.operations_order_id) {
    return {
      label: "Order completed",
      href: "/operations/orders",
      badge: "Order · auto",
    };
  }
  return null;
}

interface FinanceTxnDetailDrawerProps {
  row: FinanceTransactionRow;
  kind: "income" | "expense";
  categoryChipClass: string;
  onClose: () => void;
}

export function FinanceTxnDetailDrawer({
  row,
  kind,
  categoryChipClass,
  onClose,
}: FinanceTxnDetailDrawerProps) {
  const source = detectSource(row);
  const isIncome = kind === "income";
  const amountClass = isIncome
    ? "text-emerald-700 dark:text-emerald-300"
    : "text-rose-700 dark:text-rose-300";

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Portal out of ModuleListPanel (overflow-hidden) so the drawer is visible
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Transaction details"
        className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-sm flex-col border-l border-cream-200 bg-white shadow-2xl dark:border-hairline-dark dark:bg-panel-dark sm:max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              {isIncome ? "Income" : "Expense"} · {categoryLabel(row.category)}
            </p>
            <p
              className={cn(
                "mt-0.5 text-2xl font-bold tabular-nums",
                amountClass,
              )}
            >
              {isIncome ? "+" : "−"}
              {formatMyr(Number(row.amount_myr))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5">
          <div className="divide-y divide-cream-100 dark:divide-hairline-dark">
            <DetailRow icon={<FileText className="h-3.5 w-3.5" />} label="Description">
              {row.description}
            </DetailRow>

            <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Date">
              {fmtDate(row.txn_date)}
            </DetailRow>

            {row.counterparty ? (
              <DetailRow icon={<User className="h-3.5 w-3.5" />} label="From / counterparty">
                {row.counterparty}
              </DetailRow>
            ) : null}

            <DetailRow icon={<Tag className="h-3.5 w-3.5" />} label="Category">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                  categoryChipClass,
                )}
              >
                {categoryLabel(row.category)}
              </span>
            </DetailRow>

            <DetailRow icon={<CreditCard className="h-3.5 w-3.5" />} label="Payment method">
              {paymentMethodLabel(row.payment_method)}
            </DetailRow>

            {source ? (
              <DetailRow icon={<ArrowUpRight className="h-3.5 w-3.5" />} label="Source">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-cream-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted dark:bg-hairline-dark/60 dark:text-cream-400">
                    {source.badge}
                  </span>
                  {source.href ? (
                    <Link
                      href={source.href}
                      onClick={onClose}
                      className="inline-flex items-center gap-0.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
                    >
                      View {source.label}
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                </div>
              </DetailRow>
            ) : null}

            {row.admin_file_id && row.admin_file_name ? (
              <DetailRow icon={<Paperclip className="h-3.5 w-3.5" />} label="Document">
                <span className="inline-flex items-center gap-1 text-brand-700 dark:text-brand-300">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  {row.admin_file_name}
                </span>
              </DetailRow>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-cream-100 px-5 py-3 dark:border-hairline-dark">
          <p className="text-[10px] text-ink-muted dark:text-cream-400">
            Recorded {fmtDateTime(row.created_at)}
          </p>
        </div>
      </div>
    </>,
    document.body,
  );
}
