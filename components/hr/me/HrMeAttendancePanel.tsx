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

export function HrMeAttendancePanel({
  events,
  openEvent,
}: {
  events: HrClockEventRow[];
  openEvent: HrClockEventRow | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isClockedIn = openEvent != null;

  async function toggleClock() {
    setBusy(true);
    try {
      await fetch("/api/hr/me/attendance", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "rounded-2xl border p-6 text-center",
          isClockedIn
            ? "border-teal-200 bg-teal-50/80 dark:border-teal-900/50 dark:bg-teal-950/30"
            : "border-cream-200 bg-white dark:border-hairline-dark dark:bg-panel-dark",
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
          Current status
        </p>
        <p className="mt-2 text-2xl font-bold text-ink dark:text-cream-100">
          {isClockedIn ? "On shift" : "Not clocked in"}
        </p>
        {isClockedIn ? (
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            Since {fmtTime(openEvent.clock_in)}
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={toggleClock}
          className={cn(
            "mt-5 inline-flex min-w-[160px] items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50",
            isClockedIn ? hrClasses.btnSecondary : hrClasses.btnPrimary,
          )}
        >
          {busy
            ? "Updating…"
            : isClockedIn
              ? "Clock out"
              : "Clock in"}
        </button>
      </div>

      {events.length > 0 ? (
        <ul className="divide-y divide-cream-200 rounded-xl border border-cream-200 dark:divide-hairline-dark dark:border-hairline-dark">
          {events.slice(0, 10).map((row) => (
            <li key={row.id} className="px-4 py-3">
              <p className="text-sm font-medium text-ink dark:text-cream-100">
                {fmtTime(row.clock_in)}
                {row.clock_out ? ` → ${fmtTime(row.clock_out)}` : " · on shift"}
              </p>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {row.source}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-sm text-ink-muted dark:text-cream-400">
          Your clock history will appear here.
        </p>
      )}
    </div>
  );
}
