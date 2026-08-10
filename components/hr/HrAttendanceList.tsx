"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HrClockEventRow } from "@/lib/hr/attendance";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(iso));
}

function durationLabel(clockIn: string, clockOut: string | null): string {
  if (!clockOut) return "In progress";
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function HrAttendanceList({ items }: { items: HrClockEventRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = items.filter((row) => !row.clock_out);

  async function clockOut(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/hr/attendance/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted dark:text-cream-400">
        No clock events yet. Clock in an employee from the attendance page.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {open.length > 0 ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          {open.length} currently on shift
        </p>
      ) : null}
      <ul className="divide-y divide-cream-200 rounded-xl border border-cream-200 dark:divide-hairline-dark dark:border-hairline-dark">
        {items.map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                {row.hr_employees?.full_name ?? "Employee"}
              </p>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {fmtTime(row.clock_in)}
                {row.clock_out ? ` → ${fmtTime(row.clock_out)}` : " · on shift"}
                {" · "}
                {durationLabel(row.clock_in, row.clock_out)}
              </p>
            </div>
            {!row.clock_out ? (
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => clockOut(row.id)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                  hrClasses.btnSecondary,
                )}
              >
                Clock out
              </button>
            ) : (
              <span className="shrink-0 text-[10px] font-semibold uppercase text-ink-subtle dark:text-cream-500">
                {row.source}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
