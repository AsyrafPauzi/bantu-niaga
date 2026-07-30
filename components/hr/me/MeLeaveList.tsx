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
        className="rounded-lg border border-[#E5E0D8] px-4 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:text-cream-400"
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

function statusTone(status: string): string {
  if (status === "approved") return "text-status-success";
  if (status === "pending") return "text-accent-700 dark:text-accent-300";
  return "text-ink-muted dark:text-cream-400";
}

interface MeLeaveListProps {
  rows: HrLeaveRow[];
}

export function MeLeaveList({ rows }: MeLeaveListProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-muted dark:text-cream-400">
        No leave requests yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
      {rows.map((row) => (
        <a
          key={row.id}
          href={`/hr/me/leave/${row.id}`}
          className="flex items-start justify-between gap-3 py-3 transition-colors hover:bg-cream-50 dark:hover:bg-panel-dark/40"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${leaveTypeBadgeClass(row.leave_type)}`}
              >
                {leaveTypeShort(row.leave_type)}
              </span>
              <span className={`text-xs font-semibold ${statusTone(row.status)}`}>
                {statusLabel(row.status)}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-ink dark:text-cream-100">
              {leaveTypeLabel(row.leave_type)} · {fmtDate(row.start_date)}
              {row.end_date !== row.start_date ? ` – ${fmtDate(row.end_date)}` : ""}
            </p>
            {row.reason?.trim() ? (
              <p className="mt-0.5 truncate text-xs text-ink-muted dark:text-cream-400">
                {row.reason.trim()}
              </p>
            ) : null}
          </div>
          <span className="shrink-0 text-xs font-semibold text-brand-700 dark:text-brand-200">
            View →
          </span>
        </a>
      ))}
    </div>
  );
}
