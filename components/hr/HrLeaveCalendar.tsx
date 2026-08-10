"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HrEmployeeRow, HrLeaveRow } from "@/lib/hr/load";
import {
  leaveTypeBadgeClass,
  leaveTypeShort,
} from "@/lib/hr/leave-labels";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function toIso(year: number, month: number, day: number): string {
  return [
    year,
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function leaveOnDay(
  leave: HrLeaveRow[],
  employeeId: string,
  iso: string,
): HrLeaveRow | undefined {
  return leave.find(
    (row) =>
      row.employee_id === employeeId &&
      row.start_date <= iso &&
      row.end_date >= iso,
  );
}

export interface HrLeaveCalendarProps {
  leave: HrLeaveRow[];
  employees: HrEmployeeRow[];
}

export function HrLeaveCalendar({ leave, employees }: HrLeaveCalendarProps) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const year = cursor.getFullYear();
  const month = cursor.getMonth() + 1;
  const dayCount = daysInMonth(year, month);

  const monthLabel = cursor.toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });

  const monthLeave = useMemo(() => {
    const start = toIso(year, month, 1);
    const end = toIso(year, month, dayCount);
    return leave.filter(
      (row) =>
        (row.status === "approved" || row.status === "pending") &&
        row.start_date <= end &&
        row.end_date >= start,
    );
  }, [leave, year, month, dayCount]);

  const roster = useMemo(() => {
    const active = employees.filter((emp) => emp.status === "active");
    const onLeaveIds = new Set(monthLeave.map((row) => row.employee_id));
    const withLeave = active.filter((emp) => onLeaveIds.has(emp.id));
    const withoutLeave = active.filter((emp) => !onLeaveIds.has(emp.id));
    return [...withLeave, ...withoutLeave];
  }, [employees, monthLeave]);

  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => i + 1),
    [dayCount],
  );

  const todayIso = new Date().toISOString().slice(0, 10);

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

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-cream-200 dark:border-hairline-dark">
                <th
                  className="sticky left-0 z-10 min-w-[120px] max-w-[160px] border-r border-cream-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400 sm:min-w-[140px]"
                >
                  Employee
                </th>
                {days.map((day) => {
                  const iso = toIso(year, month, day);
                  const isToday = iso === todayIso;
                  return (
                    <th
                      key={day}
                      className={cn(
                        "min-w-[28px] px-0.5 py-2 text-center text-[10px] font-semibold tabular-nums sm:min-w-[32px]",
                        isToday
                          ? "bg-teal-50/80 text-[#0F766E] dark:bg-teal-950/30 dark:text-teal-200"
                          : "text-ink-muted dark:text-cream-400",
                      )}
                    >
                      {day}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 dark:divide-hairline-dark">
              {roster.length === 0 ? (
                <tr>
                  <td
                    colSpan={dayCount + 1}
                    className="px-3 py-8 text-center text-sm text-ink-muted dark:text-cream-400"
                  >
                    No active employees to show.
                  </td>
                </tr>
              ) : (
                roster.map((employee) => (
                  <tr key={employee.id}>
                    <td
                      className="sticky left-0 z-10 border-r border-cream-200 bg-white px-3 py-1.5 dark:border-hairline-dark dark:bg-panel-dark"
                    >
                      <p className="truncate text-xs font-semibold text-ink dark:text-cream-100">
                        {employee.full_name}
                      </p>
                      <p className="truncate text-[10px] text-ink-muted dark:text-cream-400">
                        {employee.role_title}
                      </p>
                    </td>
                    {days.map((day) => {
                      const iso = toIso(year, month, day);
                      const row = leaveOnDay(monthLeave, employee.id, iso);
                      const isToday = iso === todayIso;

                      if (!row) {
                        return (
                          <td
                            key={day}
                            className={cn(
                              "h-9 border-r border-cream-100 p-0 dark:border-hairline-dark/50 sm:h-10",
                              isToday && "bg-teal-50/40 dark:bg-teal-950/15",
                            )}
                          />
                        );
                      }

                      return (
                        <td
                          key={day}
                          className={cn(
                            "h-9 border-r border-cream-100 p-0.5 dark:border-hairline-dark/50 sm:h-10",
                            isToday && "bg-teal-50/40 dark:bg-teal-950/15",
                          )}
                          title={`${leaveTypeShort(row.leave_type)} · ${row.status}`}
                        >
                          <span
                            className={cn(
                              "flex h-full min-h-[28px] items-center justify-center rounded px-0.5 text-[9px] font-bold uppercase leading-none sm:text-[10px]",
                              leaveTypeBadgeClass(row.leave_type),
                              row.status === "pending" && "opacity-75 ring-1 ring-inset ring-amber-400/60",
                            )}
                          >
                            {leaveTypeShort(row.leave_type)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className={cn("text-xs", hrClasses.textMuted)}>
        Coloured blocks show approved or pending leave by type. Pending requests appear slightly faded with an amber ring.
      </p>
    </div>
  );
}
