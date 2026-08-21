"use client";

import { cn } from "@/lib/utils/cn";

export function BookingListFilters({
  viewMode,
  onViewModeChange,
  upcomingCount,
  weekDays,
  selectedDay,
  bookingsByDay,
  onSelectDay,
  toMalaysiaYmd,
}: {
  viewMode: "list" | "week";
  onViewModeChange: (mode: "list" | "week") => void;
  upcomingCount: number;
  weekDays: Date[];
  selectedDay: string;
  bookingsByDay: Map<string, number>;
  onSelectDay: (ymd: string) => void;
  toMalaysiaYmd: (day: Date) => string;
}) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-cream-300 p-0.5 dark:border-hairline-dark">
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold",
              viewMode === "list"
                ? "bg-brand-500 text-white"
                : "text-ink-muted dark:text-cream-400",
            )}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("week")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold",
              viewMode === "week"
                ? "bg-brand-500 text-white"
                : "text-ink-muted dark:text-cream-400",
            )}
          >
            Week
          </button>
        </div>
        <span className="text-xs text-ink-muted dark:text-cream-400">
          {upcomingCount} upcoming
        </span>
      </div>
      {viewMode === "week" ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {weekDays.map((day) => {
            const ymd = toMalaysiaYmd(day);
            const count = bookingsByDay.get(ymd) ?? 0;
            const selected = selectedDay === ymd;
            return (
              <button
                key={ymd}
                type="button"
                onClick={() => onSelectDay(ymd)}
                className={cn(
                  "flex min-w-[4.5rem] flex-col items-center rounded-xl border px-2 py-2 text-center transition-colors",
                  selected
                    ? "border-brand-400 bg-brand-50 dark:border-brand-700 dark:bg-brand-700/20"
                    : "border-cream-200 bg-white dark:border-hairline-dark dark:bg-panel-dark",
                )}
              >
                <span className="text-[10px] font-semibold uppercase text-ink-muted dark:text-cream-400">
                  {day.toLocaleDateString("en-MY", { weekday: "short" })}
                </span>
                <span className="text-lg font-bold tabular-nums text-ink dark:text-cream-100">
                  {day.getDate()}
                </span>
                {count > 0 ? (
                  <span className="mt-0.5 rounded-full bg-violet-100 px-1.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-100">
                    {count}
                  </span>
                ) : (
                  <span className="mt-0.5 text-[10px] text-ink-muted dark:text-cream-500">
                    —
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
