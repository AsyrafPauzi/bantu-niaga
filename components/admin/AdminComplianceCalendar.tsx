"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AdminComplianceRow } from "@/lib/admin/task-compliance-schemas";
import { CATEGORY_STYLE } from "@/lib/admin/compliance-shared";
import { cn } from "@/lib/utils/cn";

interface AdminComplianceCalendarProps {
  items: AdminComplianceRow[];
  onSelect: (item: AdminComplianceRow) => void;
}

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

export function AdminComplianceCalendar({
  items,
  onSelect,
}: AdminComplianceCalendarProps) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

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
    const map = new Map<string, AdminComplianceRow[]>();
    for (const item of items) {
      const key = item.expires_on;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, -1))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/60"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold text-ink dark:text-cream-100">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/60"
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
          <div key={wi} className="grid grid-cols-7 divide-x divide-cream-100 dark:divide-hairline-dark">
            {week.map((cell) => {
              if (!cell.date) {
                return (
                  <div
                    key={cell.key}
                    className="min-h-[88px] bg-cream-50/40 dark:bg-hairline-dark/10"
                  />
                );
              }

              const iso = [
                cell.date.getFullYear(),
                String(cell.date.getMonth() + 1).padStart(2, "0"),
                String(cell.date.getDate()).padStart(2, "0"),
              ].join("-");
              const dayItems = byDate.get(iso) ?? [];
              const isToday = sameDay(cell.date, today);

              return (
                <div
                  key={cell.key}
                  className={cn(
                    "min-h-[88px] p-1.5",
                    isToday && "bg-brand-50/60 dark:bg-brand-950/20",
                  )}
                >
                  <p
                    className={cn(
                      "mb-1 text-[11px] font-semibold",
                      isToday
                        ? "text-brand-700 dark:text-brand-200"
                        : "text-ink-muted dark:text-cream-400",
                    )}
                  >
                    {cell.date.getDate()}
                  </p>
                  <ul className="space-y-0.5">
                    {dayItems.slice(0, 3).map((item) => {
                      const Icon = CATEGORY_STYLE[item.category].icon;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => onSelect(item)}
                            className={cn(
                              "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium",
                              item.urgency === "overdue"
                                ? "bg-status-danger/15 text-status-danger"
                                : item.urgency === "soon"
                                  ? "bg-status-warning/20 text-[#8C5C0A] dark:text-[#F5C97A]"
                                  : "bg-cream-100 text-ink dark:bg-hairline-dark/50 dark:text-cream-200",
                            )}
                            title={item.title}
                          >
                            <Icon className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{item.title}</span>
                          </button>
                        </li>
                      );
                    })}
                    {dayItems.length > 3 ? (
                      <li className="px-1 text-[10px] text-ink-muted dark:text-cream-400">
                        +{dayItems.length - 3} more
                      </li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
