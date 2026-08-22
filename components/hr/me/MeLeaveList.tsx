"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HrLeaveRow } from "@/lib/hr/load";
import {
  leaveTypeBadgeClass,
  leaveTypeLabel,
  leaveTypeShort,
} from "@/lib/hr/leave-labels";

interface MeLeaveCancelButtonProps {
  leaveId: string;
}

export function MeLeaveCancelButton({ leaveId }: MeLeaveCancelButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onCancel() {
    if (!window.confirm("Cancel this pending leave request?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/hr/me/leave/${leaveId}/cancel`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(json?.message ?? json?.error ?? "Could not cancel request.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-cream-300 px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-cream-50 disabled:opacity-60 dark:border-hairline-dark dark:text-cream-400 dark:hover:bg-hairline-dark sm:w-auto"
      >
        {busy ? "Cancelling..." : "Cancel request"}
      </button>
      {message ? (
        <p className="text-sm text-status-warning">{message}</p>
      ) : null}
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface MeLeaveListProps {
  rows: HrLeaveRow[];
  emptyActionHref?: string;
}

export function MeLeaveList({ rows, emptyActionHref }: MeLeaveListProps) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm font-medium text-ink dark:text-cream-100">
          No leave requests yet
        </p>
        <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
          When you apply, your requests show up here.
        </p>
        {emptyActionHref ? (
          <a
            href={emptyActionHref}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F766E]"
          >
            Apply for leave
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
      {rows.map((row) => (
        <a
          key={row.id}
          href={`/hr/me/leave/${row.id}`}
          className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-cream-50 active:bg-cream-100 dark:hover:bg-panel-dark/40"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${leaveTypeBadgeClass(row.leave_type)}`}
              >
                {leaveTypeShort(row.leave_type)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusChip(row.status)}`}
              >
                {statusLabel(row.status)}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-ink dark:text-cream-100">
              {fmtDate(row.start_date)}
              {row.end_date !== row.start_date
                ? ` – ${fmtDate(row.end_date)}`
                : ""}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              {leaveTypeLabel(row.leave_type)}
              {row.reason?.trim() ? ` · ${row.reason.trim()}` : ""}
            </p>
          </div>
          <span
            className="shrink-0 text-lg text-ink-subtle dark:text-cream-500"
            aria-hidden
          >
            ›
          </span>
        </a>
      ))}
    </div>
  );
}

function statusChip(status: string): string {
  if (status === "approved") {
    return "bg-teal-50 text-[#0F766E] dark:bg-teal-950/40 dark:text-teal-200";
  }
  if (status === "pending") {
    return "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  }
  if (status === "rejected") {
    return "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200";
  }
  return "bg-cream-100 text-ink-muted dark:bg-hairline-dark dark:text-cream-400";
}
