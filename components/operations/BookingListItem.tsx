"use client";

import { Calendar, ChevronRight, Loader2 } from "lucide-react";
import { OperationsCatalogThumb } from "@/components/operations/OperationsCatalogUi";
import {
  bookingStatusLabel,
  formatBookingWhen,
  formatOrderAmount,
  type OperationsBookingRow,
  type OperationsBookingStatus,
} from "@/lib/operations/schemas";

const STATUS_TONE: Record<OperationsBookingStatus, string> = {
  held: "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
  confirmed:
    "bg-status-warning/15 text-status-warning dark:bg-status-warning/10",
  completed:
    "bg-status-success/15 text-status-success dark:bg-status-success/10",
  cancelled: "bg-cream-100 text-ink-subtle line-through dark:bg-panel-dark",
};

function nextStatus(
  current: OperationsBookingStatus,
): OperationsBookingStatus | null {
  switch (current) {
    case "held":
      return "confirmed";
    case "confirmed":
      return "completed";
    default:
      return null;
  }
}

interface BookingListItemProps {
  booking: OperationsBookingRow;
  busy: boolean;
  onAdvanceStatus: (booking: OperationsBookingRow) => void;
  onEdit: (booking: OperationsBookingRow) => void;
  onCancel: (id: string) => void;
}

export function BookingListItem({
  booking: b,
  busy,
  onAdvanceStatus,
  onEdit,
  onCancel,
}: BookingListItemProps) {
  const next = nextStatus(b.status);
  const amount = formatOrderAmount(
    b.amount_myr != null ? Number(b.amount_myr) : null,
  );
  const canAct = b.status !== "cancelled" && b.status !== "completed";

  return (
    <li className="group px-3 py-3 transition-colors hover:bg-cream-50/80 dark:hover:bg-panel-dark/60">
      <div className="flex gap-3">
        <OperationsCatalogThumb icon={<Calendar className="h-6 w-6" />} />

        <div className="min-w-0 flex-1 space-y-2">
          {/* Header: number · status · amount */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] text-ink-muted dark:text-cream-400">
                {b.number}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_TONE[b.status]}`}
              >
                {bookingStatusLabel(b.status)}
              </span>
            </div>
            {amount ? (
              <span className="shrink-0 text-sm font-bold tabular-nums text-ink dark:text-cream-100">
                {amount}
              </span>
            ) : null}
          </div>

          {/* Title + meta */}
          <div>
            <h3 className="text-sm font-semibold leading-snug text-ink dark:text-cream-100">
              {b.service_title}
            </h3>
            <p className="mt-0.5 truncate text-xs text-ink-muted dark:text-cream-400">
              {b.customer_name}
              {b.resource_name ? ` · ${b.resource_name}` : ""}
            </p>
            <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-ink-muted dark:text-cream-500">
              <Calendar className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{formatBookingWhen(b.starts_at, b.ends_at)}</span>
            </p>
          </div>

          {/* Actions — full width on mobile */}
          {canAct || next ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-cream-100 pt-2 dark:border-hairline-dark">
              {next ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAdvanceStatus(b)}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:bg-brand-700/20 dark:text-brand-300 dark:hover:bg-brand-700/30"
                >
                  {busy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {bookingStatusLabel(next)}
                </button>
              ) : null}
              {canAct ? (
                <div className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onEdit(b)}
                    className="text-[11px] font-semibold text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300"
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onCancel(b.id)}
                    className="text-[11px] font-semibold text-status-danger hover:underline disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
