"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2 } from "lucide-react";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
  ModuleListPanelHeader,
  MODULE_LIST_ROWS_CLASS,
} from "@/components/dashboard/module-list-panel";
import { ModuleListFilterChipLink } from "@/components/dashboard/module-list-search";
import type { HrClockEventRow, HrClockShiftFilter } from "@/lib/hr/attendance";
import { formatShiftDuration } from "@/lib/hr/shift-duration";
import { ADMIN_DEFAULT_PAGE_SIZE } from "@/lib/pagination";
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

function buildShiftHref(shift: HrClockShiftFilter): string {
  if (shift === "all") return "/hr/me/attendance";
  return `/hr/me/attendance?shift=${shift}`;
}

export function HrMeAttendancePanel({
  events,
  openEvent,
  shiftFilter,
  page,
  pageSize,
  total,
}: {
  events: HrClockEventRow[];
  openEvent: HrClockEventRow | null;
  shiftFilter: HrClockShiftFilter;
  page: number;
  pageSize: number;
  total: number;
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

  const chips: { shift: HrClockShiftFilter; label: string }[] = [
    { shift: "all", label: "All" },
    { shift: "open", label: "On shift" },
    { shift: "closed", label: "Completed" },
  ];

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-xl border p-5 text-center sm:p-6",
          isClockedIn
            ? "border-teal-200 bg-teal-50/80 dark:border-teal-900/50 dark:bg-teal-950/30"
            : "border-cream-200 bg-white dark:border-hairline-dark dark:bg-panel-dark",
        )}
      >
        <span
          className={cn(
            "mx-auto grid h-12 w-12 place-items-center rounded-xl",
            isClockedIn
              ? "bg-[#0D9488] text-white"
              : "bg-cream-100 text-[#0F766E] dark:bg-hairline-dark dark:text-teal-300",
          )}
        >
          <Clock className="h-6 w-6" strokeWidth={2} />
        </span>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
          Current status
        </p>
        <p className="mt-1 text-2xl font-bold text-ink dark:text-cream-100">
          {isClockedIn ? "On shift" : "Not clocked in"}
        </p>
        {isClockedIn ? (
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            Since {fmtTime(openEvent.clock_in)} ·{" "}
            {formatShiftDuration(openEvent.clock_in)}
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            Clock in when you start your shift
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={toggleClock}
          className={cn(
            "mt-5 inline-flex min-h-11 w-full max-w-xs items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50",
            isClockedIn ? hrClasses.btnSecondary : hrClasses.btnPrimary,
          )}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : null}
          {busy ? "Updating…" : isClockedIn ? "Clock out" : "Clock in"}
        </button>
      </div>

      <ModuleListPanel>
        <ModuleListPanelHeader
          title="Shift history"
          subtitle={`${total} record${total === 1 ? "" : "s"}`}
        />
        <ModuleListPanelFilters>
          <nav aria-label="Filter shifts" className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <ModuleListFilterChipLink
                key={chip.shift}
                href={buildShiftHref(chip.shift)}
                active={shiftFilter === chip.shift}
                accent="teal"
                label={chip.label}
              />
            ))}
          </nav>
        </ModuleListPanelFilters>

        {events.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-muted dark:text-cream-400">
            No shifts match this filter. Clock in to start a record.
          </p>
        ) : (
          <ul className={MODULE_LIST_ROWS_CLASS}>
            {events.map((row) => (
              <li key={row.id} className="px-4 py-3.5 sm:px-5">
                <p className="text-sm font-semibold text-ink dark:text-cream-100">
                  {fmtTime(row.clock_in)}
                  {row.clock_out
                    ? ` → ${fmtTime(row.clock_out)}`
                    : " · on shift"}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                  {row.clock_out
                    ? `Duration ${formatShiftDuration(row.clock_in, new Date(row.clock_out))}`
                    : `Elapsed ${formatShiftDuration(row.clock_in)}`}
                  <span className="mx-1">·</span>
                  {row.source === "self" || row.source === "self_service"
                    ? "Self clock"
                    : row.source}
                </p>
              </li>
            ))}
          </ul>
        )}

        <ListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          basePath="/hr/me/attendance"
          searchParams={{
            shift: shiftFilter !== "all" ? shiftFilter : undefined,
          }}
          defaultPageSize={ADMIN_DEFAULT_PAGE_SIZE}
        />
      </ModuleListPanel>
    </div>
  );
}
