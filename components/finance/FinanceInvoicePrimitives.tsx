"use client";

/**
 * Pure presentational primitives for FinanceInvoiceComposer.
 * Extracted to reduce the main component size and enable isolated testing.
 */

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ─── CSS token strings ────────────────────────────────────────────────────────
// Centralised here so a design change touches one file, not one 1800-line file.

export const fieldCx =
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

export const compactFieldCx =
  "h-9 w-full rounded-lg border border-cream-300 bg-white px-3 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

export const textareaFieldCx =
  "min-h-[72px] w-full resize-y rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm leading-relaxed text-ink focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

export const tableInputCx =
  "h-8 w-full rounded border-0 bg-transparent px-2 text-sm text-ink placeholder:text-ink-muted/60 focus:bg-cream-50 focus:outline-none focus:ring-1 focus:ring-brand-400/40 dark:text-cream-100 dark:focus:bg-panel-dark/80";

export const tableTextareaCx =
  "h-8 md:h-auto md:min-h-[52px] w-full resize-none rounded border-0 bg-transparent px-2 py-1 text-sm leading-snug text-ink placeholder:text-ink-muted/60 focus:bg-cream-50 focus:outline-none focus:ring-1 focus:ring-brand-400/40 dark:text-cream-100 dark:focus:bg-panel-dark/80";

export const summaryInputCx =
  "h-8 w-full rounded border border-cream-300 bg-white px-2 text-right text-sm tabular-nums focus:border-brand-500 focus:outline-none dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

// ─── Field ─────────────────────────────────────────────────────────────────────

export function Field({
  label,
  children,
  compact,
}: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span
        className={cn(
          "mb-1 block font-medium text-ink-muted dark:text-cream-400",
          compact ? "mb-0.5 text-[10px] uppercase tracking-wide" : "mb-1 text-xs",
        )}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

// ─── PaymentPreviewRow ─────────────────────────────────────────────────────────

export function PaymentPreviewRow({
  active,
  label,
  detail,
}: {
  active: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-2 text-xs">
      {active ? (
        <Check
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success"
          strokeWidth={2.5}
        />
      ) : (
        <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted/50 dark:text-cream-500" />
      )}
      <span className="min-w-0">
        <span
          className={cn(
            "font-medium",
            active
              ? "text-ink dark:text-cream-100"
              : "text-ink-muted dark:text-cream-400",
          )}
        >
          {label}
        </span>
        <span className="text-ink-muted dark:text-cream-500"> — {detail}</span>
      </span>
    </li>
  );
}

// ─── SummaryRow ────────────────────────────────────────────────────────────────

export function SummaryRow({
  label,
  value,
  input,
  strong,
}: {
  label: string;
  value?: string;
  input?: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 items-center gap-2 px-3 py-2 sm:px-4",
        strong && "bg-cream-50 dark:bg-panel-dark/60",
      )}
    >
      <span
        className={cn(
          "text-sm",
          strong
            ? "font-bold text-ink dark:text-cream-100"
            : "text-ink-muted dark:text-cream-400",
        )}
      >
        {label}
      </span>
      {input ?? (
        <span
          className={cn(
            "text-right text-sm tabular-nums",
            strong
              ? "text-lg font-bold text-ink dark:text-cream-100"
              : "text-ink dark:text-cream-100",
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}
