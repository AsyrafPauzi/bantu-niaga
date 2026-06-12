import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { ContentPlatformBadge } from "./ContentPlatformBadge";
import { ContentStatusBadge } from "./ContentStatusBadge";
import type { ContentEntryRow } from "./types";

/**
 * Desktop month calendar grid (6 rows × 7 cols).
 *
 * Pure rendering — server-component safe. The page passes:
 *   - `year` / `month` (1..12, MYT)
 *   - the entries already filtered to this month
 *   - an `onCreateHref(date)` builder that produces the "new entry"
 *     prefill link the empty-cell action navigates to.
 *
 * Dates in `entries.scheduled_at` are UTC ISO strings; we bucket them
 * into MYT (Asia/Kuala_Lumpur, UTC+8, no DST) days for the cell mapping.
 *
 * Mobile renders a list, not this grid — see `<ContentListMobile>`.
 *
 * "6-week grid" promise: the component always emits 42 cells so the
 * column alignment stays stable regardless of which weekday the month
 * starts on.
 */

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface ContentCalendarProps {
  year: number;
  month: number; // 1..12
  entries: ContentEntryRow[];
  /** Path to navigate to when the operator clicks an empty cell. */
  newEntryHref: (isoLocalDate: string) => string;
  /** Path to a single content entry's detail page. */
  entryHref: (entryId: string) => string;
  /** Optional "previous month" link target (e.g. `?year=&month=`). */
  prevHref?: string;
  /** Optional "next month" link target. */
  nextHref?: string;
  /** "Today" anchor; defaults to now (so the page can SSR with the server's clock). */
  today?: Date;
  className?: string;
}

interface DayCell {
  isoLocalDate: string; // YYYY-MM-DD in MYT
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

const MYT_OFFSET_MS = 8 * 3_600_000;

/** Returns a YYYY-MM-DD string for the given UTC ms, evaluated in MYT. */
function isoLocalDateFromUtcMs(utcMs: number): string {
  const myt = new Date(utcMs + MYT_OFFSET_MS);
  const y = myt.getUTCFullYear();
  const m = String(myt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(myt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Build the 42 cells (6 rows × 7 cols) starting on Monday. */
function buildCells(year: number, month: number, today: Date): DayCell[] {
  // First day of month at MYT midnight, expressed in UTC.
  const firstUtc = new Date(Date.UTC(year, month - 1, 1, -8, 0, 0));
  // JS getUTCDay: Sun=0, Mon=1, … Sat=6. We want Monday=0.
  const firstWeekday = (firstUtc.getUTCDay() + 6) % 7;
  // Walk back to the Monday on/before the 1st.
  const gridStartUtcMs = firstUtc.getTime() - firstWeekday * 86_400_000;
  const todayLocal = isoLocalDateFromUtcMs(today.getTime());

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const cellUtcMs = gridStartUtcMs + i * 86_400_000;
    const myt = new Date(cellUtcMs + MYT_OFFSET_MS);
    const dayNumber = myt.getUTCDate();
    const cellMonth = myt.getUTCMonth() + 1;
    const cellYear = myt.getUTCFullYear();
    const iso = isoLocalDateFromUtcMs(cellUtcMs);
    cells.push({
      isoLocalDate: iso,
      dayNumber,
      isCurrentMonth: cellMonth === month && cellYear === year,
      isToday: iso === todayLocal,
    });
  }
  return cells;
}

function bucketEntriesByDay(
  entries: ContentEntryRow[],
): Map<string, ContentEntryRow[]> {
  const out = new Map<string, ContentEntryRow[]>();
  for (const e of entries) {
    if (!e.scheduled_at) continue;
    const t = Date.parse(e.scheduled_at);
    if (Number.isNaN(t)) continue;
    const iso = isoLocalDateFromUtcMs(t);
    const arr = out.get(iso) ?? [];
    arr.push(e);
    out.set(iso, arr);
  }
  // Stable order within a day: by scheduled_at asc.
  for (const arr of out.values()) {
    arr.sort((a, b) => {
      const ta = a.scheduled_at ? Date.parse(a.scheduled_at) : 0;
      const tb = b.scheduled_at ? Date.parse(b.scheduled_at) : 0;
      return ta - tb;
    });
  }
  return out;
}

export function ContentCalendar({
  year,
  month,
  entries,
  newEntryHref,
  entryHref,
  prevHref,
  nextHref,
  today = new Date(),
  className,
}: ContentCalendarProps) {
  const cells = buildCells(year, month, today);
  const buckets = bucketEntriesByDay(entries);

  return (
    <div
      className={cn(
        "rounded-xl border border-hairline-light bg-panel-light shadow-card",
        "dark:border-hairline-dark dark:bg-panel-dark",
        className,
      )}
      data-testid="content-calendar"
      data-year={year}
      data-month={month}
    >
      <header className="flex items-center justify-between gap-3 border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
        <div className="flex items-center gap-2">
          {prevHref && (
            <Link
              href={prevHref}
              aria-label="Previous month"
              className="rounded-md border border-cream-200 px-2 py-1 text-sm text-ink hover:bg-cream-200 dark:border-hairline-dark dark:text-cream-100 dark:hover:bg-hairline-dark"
            >
              ←
            </Link>
          )}
          {nextHref && (
            <Link
              href={nextHref}
              aria-label="Next month"
              className="rounded-md border border-cream-200 px-2 py-1 text-sm text-ink hover:bg-cream-200 dark:border-hairline-dark dark:text-cream-100 dark:hover:bg-hairline-dark"
            >
              →
            </Link>
          )}
        </div>
        <h2 className="text-base font-semibold text-ink dark:text-cream-100">
          {MONTH_LABELS[month - 1]} {year}
        </h2>
        <span className="text-xs text-ink-muted dark:text-cream-400">
          MYT · Asia/Kuala_Lumpur
        </span>
      </header>

      <div className="grid grid-cols-7 border-b border-cream-200 bg-cream-100/60 text-xs uppercase tracking-wide text-ink-muted dark:border-hairline-dark dark:bg-panel-dark/40 dark:text-cream-400">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="px-2 py-2 text-center font-medium">
            {w}
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-7"
        role="grid"
        aria-label={`${MONTH_LABELS[month - 1]} ${year} content calendar`}
      >
        {cells.map((cell, i) => {
          const dayEntries = buckets.get(cell.isoLocalDate) ?? [];
          return (
            <div
              key={`${cell.isoLocalDate}-${i}`}
              role="gridcell"
              data-iso-date={cell.isoLocalDate}
              data-current-month={cell.isCurrentMonth ? "true" : "false"}
              data-today={cell.isToday ? "true" : "false"}
              className={cn(
                "relative min-h-[112px] border-b border-r border-cream-200 p-1.5",
                "dark:border-hairline-dark",
                !cell.isCurrentMonth &&
                  "bg-cream-100/40 dark:bg-panel-dark/30",
                cell.isToday && "ring-2 ring-inset ring-brand-400",
                i % 7 === 6 && "border-r-0",
                i >= 35 && "border-b-0",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-medium",
                    cell.isCurrentMonth
                      ? "text-ink dark:text-cream-100"
                      : "text-ink-muted dark:text-cream-400",
                  )}
                >
                  {cell.dayNumber}
                </span>
                {cell.isCurrentMonth && (
                  <Link
                    href={newEntryHref(cell.isoLocalDate)}
                    aria-label={`New entry on ${cell.isoLocalDate}`}
                    className="rounded text-[10px] font-semibold text-brand-700 hover:underline dark:text-brand-300"
                  >
                    + Add
                  </Link>
                )}
              </div>

              <div className="mt-1 flex flex-col gap-1">
                {dayEntries.map((e) => (
                  <Link
                    key={e.id}
                    href={entryHref(e.id)}
                    className="block rounded-md border border-cream-200 bg-panel-light px-1.5 py-1 text-left text-[11px] hover:border-brand-400 hover:shadow-sm dark:border-hairline-dark dark:bg-panel-dark"
                    data-entry-id={e.id}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <ContentPlatformBadge channel={e.channel} size="xs" />
                      <span className="text-[10px] text-ink-muted dark:text-cream-400">
                        {e.scheduled_at
                          ? formatMytTime(e.scheduled_at)
                          : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-ink dark:text-cream-100">
                      {e.hook || e.caption || "(untitled)"}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <ContentStatusBadge status={e.status} />
                      {e.media && e.media.length > 0 && (
                        <span className="text-[10px] text-ink-muted dark:text-cream-400">
                          📎 {e.media.length}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatMytTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-MY", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
