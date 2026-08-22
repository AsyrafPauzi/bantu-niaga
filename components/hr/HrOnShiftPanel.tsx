"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import type { HrClockEventRow } from "@/lib/hr/attendance";
import { formatShiftDuration } from "@/lib/hr/shift-duration";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

function fmtClockIn(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(iso));
}

function LiveDuration({ since }: { since: string }) {
  const [label, setLabel] = useState(() => formatShiftDuration(since));

  useEffect(() => {
    setLabel(formatShiftDuration(since));
    const id = window.setInterval(() => {
      setLabel(formatShiftDuration(since));
    }, 30_000);
    return () => window.clearInterval(id);
  }, [since]);

  return (
    <span className="tabular-nums font-semibold text-[#0F766E] dark:text-teal-300">
      {label}
    </span>
  );
}

export function HrOnShiftPanel({
  events,
  addonActive,
}: {
  events: HrClockEventRow[];
  addonActive: boolean;
}) {
  if (!addonActive) {
    return (
      <section
        className={cn(
          "rounded-xl border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark",
        )}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream-100 text-[#0F766E] dark:bg-hairline-dark dark:text-teal-300">
            <Clock className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Who&apos;s on shift
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              Activate Shift Attendance to see live clock-ins here.
            </p>
            <Link
              href="/marketplace"
              className={cn("mt-2 inline-block text-xs font-semibold", hrClasses.link)}
            >
              Open Marketplace →
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-cream-200 bg-white dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-center justify-between gap-2 border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
            Who&apos;s on shift
          </h2>
          <p className="text-xs text-ink-muted dark:text-cream-400">
            {events.length === 0
              ? "Nobody clocked in right now"
              : `${events.length} on the clock`}
          </p>
        </div>
        <Link
          href="/hr/attendance"
          className={cn("shrink-0 text-xs font-semibold", hrClasses.link)}
        >
          Attendance →
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-8 text-center">
          <Clock className="h-8 w-8 text-ink-subtle dark:text-cream-500" />
          <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
            No one is clocked in. Staff clock in from /hr/me or you can clock
            them in on Attendance.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
          {events.map((row) => {
            const name = row.hr_employees?.full_name ?? "Employee";
            const role = row.hr_employees?.role_title;
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-50 text-xs font-bold uppercase text-[#0F766E] dark:bg-teal-950/40 dark:text-teal-200">
                    {name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")}
                    <span
                      className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#0D9488] dark:border-panel-dark"
                      aria-hidden
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                      {name}
                    </p>
                    <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                      {role ? `${role} · ` : ""}
                      since {fmtClockIn(row.clock_in)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-500">
                    On shift
                  </p>
                  <LiveDuration since={row.clock_in} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
