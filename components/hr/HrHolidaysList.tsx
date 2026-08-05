"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { HrHolidayRow } from "@/lib/hr/load";
import { STATE_LABELS } from "@/lib/hr/state-codes";
import { hrClasses } from "@/lib/hr/theme";
import { paginateArray, totalPages } from "@/lib/pagination";
import { cn } from "@/lib/utils/cn";

const PAGE_SIZE = 10;

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-MY", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function daysLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return "Passed";
  return `In ${days} days`;
}

export interface HrHolidaysListProps {
  holidays: HrHolidayRow[];
}

export function HrHolidaysList({ holidays }: HrHolidaysListProps) {
  const [page, setPage] = useState(1);

  const { items: pageItems, total } = useMemo(
    () => paginateArray(holidays, page, PAGE_SIZE),
    [holidays, page],
  );

  const pageCount = totalPages(total, PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const grouped = useMemo(() => {
    const map = new Map<string, HrHolidayRow[]>();
    for (const holiday of pageItems) {
      const key = monthKey(holiday.holiday_date);
      const list = map.get(key) ?? [];
      list.push(holiday);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [pageItems]);

  if (holidays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-teal-200/80 bg-teal-50/30 px-6 py-14 text-center dark:border-teal-900/40 dark:bg-teal-950/20">
        <div
          className={cn(
            "mb-3 flex h-12 w-12 items-center justify-center rounded-full",
            hrClasses.iconBox,
          )}
        >
          <CalendarDays className="h-6 w-6" strokeWidth={2} />
        </div>
        <p className="text-sm font-semibold text-ink dark:text-cream-100">
          No upcoming holidays on file
        </p>
        <p className="mt-1 max-w-xs text-xs text-ink-muted dark:text-cream-400">
          Import the Malaysia calendar or add a company day from the panel on the
          right.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([key, monthHolidays]) => (
        <div key={key}>
          <p
            className={cn(
              "mb-2 text-[11px] font-bold uppercase tracking-widest",
              hrClasses.textMuted,
            )}
          >
            {monthLabel(key)}
          </p>
          <ul className="space-y-2">
            {monthHolidays.map((holiday) => {
              const days = daysUntil(holiday.holiday_date);
              const dayNum = new Date(`${holiday.holiday_date}T00:00:00`).getDate();
              const scope = holiday.state_code
                ? (STATE_LABELS[holiday.state_code] ?? holiday.state_code)
                : "Nationwide";

              return (
                <li
                  key={holiday.id}
                  className="group flex items-stretch gap-3 rounded-xl border border-cream-200/90 bg-white p-3 shadow-sm transition hover:border-teal-200/80 hover:shadow-md dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-teal-900/50"
                >
                  <div
                    className={cn(
                      "flex w-14 shrink-0 flex-col items-center justify-center rounded-lg py-2 text-center",
                      days === 0
                        ? "bg-[#0D9488] text-white"
                        : hrClasses.iconBox,
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase leading-none opacity-80">
                      {new Date(`${holiday.holiday_date}T00:00:00`).toLocaleDateString(
                        "en-MY",
                        { month: "short" },
                      )}
                    </span>
                    <span className="text-xl font-bold leading-tight">{dayNum}</span>
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                      {holiday.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                      {scope} · {fmtDate(holiday.holiday_date)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "hidden shrink-0 self-center rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline",
                      days === 0
                        ? "bg-[#0D9488] text-white"
                        : days === 1
                          ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                          : hrClasses.chip,
                    )}
                  >
                    {daysLabel(days)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between border-t border-cream-200 pt-3 dark:border-hairline-dark">
          <p className="text-xs text-ink-muted dark:text-cream-400">
            {total} upcoming · page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40",
                hrClasses.btnSecondary,
              )}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40",
                hrClasses.btnPrimary,
              )}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
