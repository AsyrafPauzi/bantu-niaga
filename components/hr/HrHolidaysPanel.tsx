"use client";

import { useState } from "react";
import { CalendarDays, List } from "lucide-react";
import { HrHolidaysCalendar } from "@/components/hr/HrHolidaysCalendar";
import { HrHolidaysList } from "@/components/hr/HrHolidaysList";
import type { HrHolidayRow } from "@/lib/hr/load";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

type ViewMode = "list" | "calendar";

export interface HrHolidaysPanelProps {
  upcoming: HrHolidayRow[];
  yearHolidays: HrHolidayRow[];
  year: number;
}

export function HrHolidaysPanel({ upcoming, yearHolidays, year }: HrHolidaysPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className={hrClasses.sectionTitle}>
            {viewMode === "list" ? "Upcoming holidays" : `${year} calendar`}
          </h2>
          {viewMode === "list" && upcoming.length > 0 ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                hrClasses.chip,
              )}
            >
              {upcoming.length} total
            </span>
          ) : null}
        </div>

        <div className="flex rounded-lg border border-cream-200 bg-white p-0.5 dark:border-hairline-dark dark:bg-panel-dark">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
              viewMode === "list"
                ? "bg-[#0D9488] text-white"
                : "text-ink-muted hover:text-ink dark:text-cream-400",
            )}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            aria-pressed={viewMode === "calendar"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
              viewMode === "calendar"
                ? "bg-[#0D9488] text-white"
                : "text-ink-muted hover:text-ink dark:text-cream-400",
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Calendar
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
        <HrHolidaysList holidays={upcoming} />
      ) : (
        <HrHolidaysCalendar holidays={yearHolidays} />
      )}
    </section>
  );
}
