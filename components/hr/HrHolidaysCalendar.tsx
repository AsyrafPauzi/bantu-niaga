"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HrHolidayRow } from "@/lib/hr/load";
import { STATE_LABELS } from "@/lib/hr/state-codes";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toIso(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export interface HrHolidaysCalendarProps {
  holidays: HrHolidayRow[];
}

export function HrHolidaysCalendar({ holidays }: HrHolidaysCalendarProps) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { weeks, monthLabel } = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = last.getDate();

    const cells: Array<{ date: Date | null; key: string }> = [];
    for (let i = 0; i < startPad; i++) {
      cells.push({ date: null, key: `pad-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), key: `d-${d}` });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, key: `tail-${cells.length}` });
    }

    const weeks: Array<typeof cells> = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    const monthLabel = cursor.toLocaleDateString("en-MY", {
      month: "long",
      year: "numeric",
    });

    return { weeks, monthLabel };
  }, [cursor]);

  const byDate = useMemo(() => {
    const map = new Map<string, HrHolidayRow[]>();
    for (const holiday of holidays) {
      const list = map.get(holiday.holiday_date) ?? [];
      list.push(holiday);
      map.set(holiday.holiday_date, list);
    }
    return map;
  }, [holidays]);

  const selectedHolidays = selectedIso ? (byDate.get(selectedIso) ?? []) : [];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-cream-200 bg-white shadow-sm dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex items-center justify-between border-b border-cream-200 px-3 py-2.5 dark:border-hairline-dark sm:px-4">
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-teal-50 dark:hover:bg-teal-950/30"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-bold text-ink dark:text-cream-100">{monthLabel}</p>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-teal-50 dark:hover:bg-teal-950/30"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-cream-200 text-center text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:border-hairline-dark dark:text-cream-400">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-1 py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="divide-y divide-cream-100 dark:divide-hairline-dark">
          {weeks.map((week, wi) => (
            <div
              key={wi}
              className="grid grid-cols-7 divide-x divide-cream-100 dark:divide-hairline-dark"
            >
              {week.map((cell) => {
                if (!cell.date) {
                  return (
                    <div
                      key={cell.key}
                      className="min-h-[72px] bg-cream-50/40 sm:min-h-[88px] dark:bg-hairline-dark/10"
                    />
                  );
                }

                const iso = toIso(cell.date);
                const dayItems = byDate.get(iso) ?? [];
                const isToday = sameDay(cell.date, today);
                const isPast = cell.date < today;
                const isSelected = selectedIso === iso;

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedIso(iso)}
                    className={cn(
                      "min-h-[72px] p-1.5 text-left transition sm:min-h-[88px] sm:p-2",
                      isToday && "bg-teal-50/70 dark:bg-teal-950/25",
                      isSelected && "ring-2 ring-inset ring-[#0D9488]/50",
                      !isToday && !isSelected && "hover:bg-cream-50/80 dark:hover:bg-hairline-dark/20",
                      isPast && !dayItems.length && "opacity-60",
                    )}
                  >
                    <p
                      className={cn(
                        "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                        isToday
                          ? "bg-[#0D9488] text-white"
                          : dayItems.length
                            ? "text-[#0F766E] dark:text-teal-300"
                            : "text-ink-muted dark:text-cream-400",
                      )}
                    >
                      {cell.date.getDate()}
                    </p>
                    <ul className="space-y-0.5">
                      {dayItems.slice(0, 2).map((holiday) => (
                        <li
                          key={holiday.id}
                          className={cn(
                            "truncate rounded px-1 py-0.5 text-[9px] font-semibold leading-tight sm:text-[10px]",
                            isPast
                              ? "bg-cream-100 text-ink-muted dark:bg-hairline-dark/50 dark:text-cream-400"
                              : "bg-teal-50 text-[#0F766E] dark:bg-teal-950/40 dark:text-teal-200",
                          )}
                          title={holiday.name}
                        >
                          {holiday.name}
                        </li>
                      ))}
                      {dayItems.length > 2 ? (
                        <li className="px-1 text-[9px] text-ink-muted dark:text-cream-400">
                          +{dayItems.length - 2}
                        </li>
                      ) : null}
                    </ul>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selectedIso ? (
        <div className="rounded-xl border border-cream-200 bg-white p-3 shadow-sm dark:border-hairline-dark dark:bg-panel-dark sm:p-4">
          <p className="text-xs font-semibold text-ink-muted dark:text-cream-400">
            {new Date(`${selectedIso}T00:00:00`).toLocaleDateString("en-MY", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          {selectedHolidays.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
              No public holidays on this day.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {selectedHolidays.map((holiday) => {
                const scope = holiday.state_code
                  ? (STATE_LABELS[holiday.state_code] ?? holiday.state_code)
                  : "Nationwide";
                return (
                  <li
                    key={holiday.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-teal-100/80 bg-teal-50/40 px-3 py-2 dark:border-teal-900/40 dark:bg-teal-950/20"
                  >
                    <span className="text-sm font-semibold text-ink dark:text-cream-100">
                      {holiday.name}
                    </span>
                    <span className={cn("shrink-0 text-[11px] font-semibold", hrClasses.chip)}>
                      {scope}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
