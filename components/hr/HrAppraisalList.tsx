"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  appraisalDisplayStatus,
  appraisalStatusLabel,
  type AppraisalDisplayStatus,
} from "@/lib/hr/appraisal";
import type { HrStaffAppraisalRow } from "@/lib/hr/load";
import { cn } from "@/lib/utils/cn";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

const STATUS_STYLES: Record<AppraisalDisplayStatus, string> = {
  pending: "bg-cream-100 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
  overdue: "bg-status-danger/10 text-status-danger",
  completed: "bg-status-success/10 text-status-success",
};

export function HrAppraisalList({
  items,
  todayIso,
}: {
  items: HrStaffAppraisalRow[];
  todayIso: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = items.filter((item) => item.status !== "completed");
  const completed = items.filter((item) => item.status === "completed");
  const overdueCount = open.filter(
    (item) => appraisalDisplayStatus(item, todayIso) === "overdue",
  ).length;

  async function markCompleted(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/hr/appraisals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", rating: 3 }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-ink dark:text-cream-100">
          {items.length === 0
            ? "No appraisals scheduled"
            : `${completed.length} of ${items.length} completed`}
        </span>
        {overdueCount > 0 ? (
          <span className="text-xs font-semibold text-status-danger">
            {overdueCount} overdue
          </span>
        ) : null}
      </div>

      {open.length === 0 && items.length > 0 ? (
        <p className="text-sm text-ink-muted dark:text-cream-400">
          All scheduled appraisals are complete.
        </p>
      ) : (
        <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
          {open.map((item) => {
            const displayStatus = appraisalDisplayStatus(item, todayIso);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink dark:text-cream-100">
                      {item.hr_employees?.full_name ?? "Employee"}
                    </p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        STATUS_STYLES[displayStatus],
                      )}
                    >
                      {appraisalStatusLabel(displayStatus)}
                    </span>
                  </div>
                  <p className="text-sm text-ink dark:text-cream-100">
                    {item.period_label}
                  </p>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    Due {fmtDate(item.due_date)}
                    {item.hr_employees?.role_title
                      ? ` · ${item.hr_employees.role_title}`
                      : ""}
                  </p>
                  {item.notes ? (
                    <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                      {item.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/hr/employees/${item.employee_id}`}
                    className="text-xs font-semibold text-brand-700 dark:text-brand-200"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => markCompleted(item.id)}
                    className="rounded-md border border-cream-300 px-2 py-1 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-60 dark:border-hairline-dark dark:text-cream-400"
                  >
                    Mark done
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {completed.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-ink-muted dark:text-cream-400">
            Completed ({completed.length})
          </summary>
          <ul className="mt-2 space-y-2 text-ink-muted dark:text-cream-400">
            {completed.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span>
                  {item.hr_employees?.full_name ?? "Employee"} — {item.period_label}
                  {item.rating ? ` · ${item.rating}/5` : ""}
                </span>
                <span className="shrink-0 text-xs">{fmtDate(item.due_date)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
