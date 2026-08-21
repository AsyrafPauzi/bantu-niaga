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

  return (
    <li className="group px-3 py-2.5 transition-colors hover:bg-cream-50/80 dark:hover:bg-panel-dark/60">
      <div className="flex items-start gap-3">
        <OperationsCatalogThumb emoji="📅" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-ink-muted dark:text-cream-400">
              {b.number}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_TONE[b.status]}`}
            >
              {bookingStatusLabel(b.status)}
            </span>
          </div>
          <h3 className="mt-0.5 text-sm font-semibold text-ink dark:text-cream-100">
            {b.service_title}
          </h3>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            {b.customer_name}
            {b.resource_name ? ` · ${b.resource_name}` : ""}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted dark:text-cream-500">
            <Calendar className="h-3 w-3 shrink-0" />
            {formatBookingWhen(b.starts_at, b.ends_at)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {amount ? (
            <span className="text-sm font-bold tabular-nums text-ink dark:text-cream-100">
              {amount}
            </span>
          ) : null}
          {next ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAdvanceStatus(b)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300"
            >
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {bookingStatusLabel(next)}
            </button>
          ) : null}
        </div>
      </div>
      {b.status !== "cancelled" && b.status !== "completed" ? (
        <div className="mt-2 flex flex-wrap gap-2 pl-[3.75rem]">
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
            className="text-[11px] text-status-danger hover:underline disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </li>
  );
}
