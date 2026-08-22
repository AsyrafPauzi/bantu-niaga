import type { ReactNode } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  CHANNEL_META,
  type CalendarCell,
  type ContentCalendarRow,
  type ContentChannel,
  type ContentStatus,
  formatDayHeading,
  formatPostTime,
  MONTH_LABELS,
  STATUS_META,
  type MonthStats,
} from "@/lib/marketing/content-calendar-shared";

export type ContentCalendarViewMode = "calendar" | "list";

interface ContentCalendarViewProps {
  year: number;
  month: number;
  todayKey: string;
  cells: CalendarCell[];
  entriesByDate: Map<string, ContentCalendarRow[]>;
  monthStats: MonthStats;
  backlogCount: number;
  channelFilter?: ContentChannel;
  statusFilter?: ContentStatus;
  viewMode?: ContentCalendarViewMode;
  buildMonthHref: (y: number, m: number) => string;
  filterHref: (next: {
    channel?: ContentChannel;
    status?: ContentStatus;
  }) => string;
  viewHref: (mode: ContentCalendarViewMode) => string;
  resetHref: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function StatPill({
  label,
  value,
  active,
  href,
}: {
  label: string;
  value: number;
  active?: boolean;
  href?: string;
}) {
  const className = cn(
    "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
            active
      ? "border-purple-600 bg-purple-600 text-white shadow-sm dark:border-purple-700 dark:bg-purple-700"
      : "border-cream-200 bg-white/70 text-ink hover:border-purple-300 dark:border-hairline-dark dark:bg-panel-dark/80 dark:text-cream-100 dark:hover:border-purple-800",
  );
  const inner = (
    <>
      <span className="tabular-nums text-sm font-bold">{value}</span>
      <span
        className={cn(
          active ? "text-white/90" : "text-ink-muted dark:text-cream-400",
        )}
      >
        {label}
      </span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <span className={className}>{inner}</span>;
}

function ChannelFilterChip({
  channel,
  active,
  href,
}: {
  channel: ContentChannel;
  active: boolean;
  href: string;
}) {
  const meta = CHANNEL_META[channel];
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
        active
          ? "border-purple-600 bg-purple-600 text-white dark:border-purple-700 dark:bg-purple-700"
          : "border-cream-200 bg-white text-ink-muted hover:border-purple-300 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400 dark:hover:border-purple-800",
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
      {meta.label}
    </Link>
  );
}

function PostChip({ post }: { post: ContentCalendarRow }) {
  const channel = CHANNEL_META[post.channel];
  const status = STATUS_META[post.status];
  return (
    <Link
      href={`/marketing/content/${post.id}`}
      title={post.hook ?? "Untitled post"}
      className={cn(
        "group/post flex min-w-0 items-center gap-1.5 rounded-md border border-transparent px-1.5 py-1 text-[10px] font-semibold transition",
        "hover:border-white/20 hover:shadow-sm",
        channel.chip,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", channel.dot)} />
      <span className="min-w-0 truncate">{post.hook ?? "Untitled"}</span>
      <span
        className={cn(
          "hidden shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide group-hover/post:inline",
          status.pill,
        )}
      >
        {status.label}
      </span>
    </Link>
  );
}

function DayCell({
  cell,
  posts,
}: {
  cell: CalendarCell;
  posts: ContentCalendarRow[];
}) {
  const newPostHref = `/marketing/content/new?date=${cell.dateKey}`;

  return (
    <div
      className={cn(
        "group relative flex min-h-[7.5rem] flex-col rounded-xl border p-2 transition-all",
        cell.inMonth
          ? cell.isWeekend
            ? "border-cream-200/80 bg-cream-50/50 dark:border-hairline-dark dark:bg-panel-dark/60"
            : "border-cream-200 bg-white dark:border-hairline-dark dark:bg-panel-dark"
          : "border-transparent bg-cream-50/30 opacity-50 dark:bg-panel-dark/20",
        cell.isToday &&
          "ring-2 ring-purple-500/70 ring-offset-1 ring-offset-white dark:ring-purple-400/60 dark:ring-offset-surface-dark",
        cell.inMonth &&
          posts.length === 0 &&
          "hover:border-dashed hover:border-purple-300 dark:hover:border-purple-800",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-xs font-bold tabular-nums",
              cell.isToday
                ? "text-violet-700 dark:text-violet-300"
                : cell.inMonth
                  ? "text-ink dark:text-cream-100"
                  : "text-ink-subtle",
            )}
          >
            {cell.day}
          </span>
          {cell.isToday ? (
            <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white dark:bg-violet-500">
              Today
            </span>
          ) : null}
        </div>
        {cell.inMonth ? (
          <Link
            href={newPostHref}
            aria-label={`New post on ${cell.dateKey}`}
            className="rounded-md p-0.5 text-violet-600 opacity-0 transition group-hover:opacity-100 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-950/50"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </Link>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto max-h-28">
        {posts.map((p) => (
          <PostChip key={p.id} post={p} />
        ))}
      </div>

      {cell.inMonth && posts.length === 0 ? (
        <Link
          href={newPostHref}
          className="mt-auto pt-1 text-[10px] font-medium text-ink-muted opacity-0 transition group-hover:opacity-100 dark:text-cream-400"
        >
          Plan a post
        </Link>
      ) : null}
    </div>
  );
}

export function ContentCalendarDesktop({
  year,
  month,
  todayKey,
  cells,
  entriesByDate,
}: Pick<
  ContentCalendarViewProps,
  "year" | "month" | "todayKey" | "cells" | "entriesByDate"
>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-cream-200 bg-white p-3 shadow-sm dark:border-hairline-dark dark:bg-panel-dark sm:p-4">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((d) => (
            <p
              key={d}
              className="px-1 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-ink-muted dark:text-cream-400"
            >
              {d}
            </p>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((cell, idx) => (
            <DayCell
              key={`${cell.dateKey}-${idx}`}
              cell={cell}
              posts={entriesByDate.get(cell.dateKey) ?? []}
            />
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-[10px] text-ink-muted dark:text-cream-400">
        {MONTH_LABELS[month - 1]} {year} · posts shown by scheduled date (MYT)
      </p>
    </div>
  );
}

export function ContentCalendarMobileList({
  year,
  month,
  todayKey,
  entriesByDate,
}: Pick<
  ContentCalendarViewProps,
  "year" | "month" | "todayKey" | "entriesByDate"
>) {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const days = Array.from(entriesByDate.entries())
    .filter(([key]) => key.startsWith(monthPrefix))
    .sort(([a], [b]) => a.localeCompare(b));

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-cream-300 bg-cream-50/40 p-8 text-center dark:border-hairline-dark dark:bg-panel-dark/50">
        <p className="text-sm font-semibold text-ink dark:text-cream-100">
          No posts scheduled in {MONTH_LABELS[month - 1]}
        </p>
        <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
          Switch to calendar view or create a new post to plan content.
        </p>
        <Link
          href={`/marketing/content/new?date=${todayKey}`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
        >
          <Plus className="h-3.5 w-3.5" />
          New post
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {days.map(([dateKey, posts]) => (
        <section
          key={dateKey}
          className="rounded-xl border border-cream-200 bg-white shadow-sm dark:border-hairline-dark dark:bg-panel-dark"
        >
          <header className="flex items-center justify-between border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
            <p className="text-sm font-bold text-ink dark:text-cream-100">
              {formatDayHeading(dateKey)}
            </p>
            {dateKey === todayKey ? (
              <span className="rounded-full bg-purple-600/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white dark:bg-purple-700">
                Today
              </span>
            ) : null}
          </header>
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {posts.map((post) => {
              const channel = CHANNEL_META[post.channel];
              const status = STATUS_META[post.status];
              return (
                <li key={post.id}>
                  <Link
                    href={`/marketing/content/${post.id}`}
                    className="flex items-start gap-3 px-4 py-3 transition hover:bg-cream-50 dark:hover:bg-hairline-dark/30"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        channel.dot,
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                        {post.hook ?? "Untitled post"}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                        {channel.label}
                        {post.scheduled_at
                          ? ` · ${formatPostTime(post.scheduled_at)}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        status.pill,
                      )}
                    >
                      {status.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ContentCalendarShell({
  year,
  month,
  todayKey,
  monthStats,
  backlogCount,
  channelFilter,
  statusFilter,
  viewMode = "calendar",
  buildMonthHref,
  filterHref,
  viewHref,
  resetHref,
  children,
}: Omit<
  ContentCalendarViewProps,
  "cells" | "entriesByDate"
> & { children: ReactNode }) {
  const prevMonth =
    month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth =
    month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const now = new Date();
  const thisMonthHref = (() => {
    const u = new URLSearchParams();
    u.set("year", String(now.getFullYear()));
    u.set("month", String(now.getMonth() + 1));
    if (channelFilter) u.set("channel", channelFilter);
    if (statusFilter) u.set("status", statusFilter);
    if (viewMode === "list") u.set("view", "list");
    return `/marketing/content?${u.toString()}`;
  })();

  return (
    <div className="space-y-4">
      <header className="overflow-hidden rounded-xl border border-purple-200/80 bg-gradient-to-br from-purple-50/90 via-white to-cream-100 p-4 shadow-sm dark:border-purple-900/40 dark:from-purple-950/20 dark:via-panel-dark dark:to-surface-dark sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-purple-700 dark:text-purple-300/80">
                Marketing · Content
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
                Content calendar
              </h1>
              <p className="mt-0.5 max-w-xl text-sm text-ink-muted dark:text-cream-400">
                Plan hooks and captions across TikTok, Instagram, and Facebook.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="View mode"
                className="inline-flex rounded-lg border border-cream-200 bg-white p-0.5 dark:border-hairline-dark dark:bg-panel-dark"
              >
                <Link
                  href={viewHref("calendar")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
                    viewMode === "calendar"
                      ? "bg-purple-600 text-white shadow-sm dark:bg-purple-700"
                      : "text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100",
                  )}
                >
                  <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
                  Calendar
                </Link>
                <Link
                  href={viewHref("list")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
                    viewMode === "list"
                      ? "bg-purple-600 text-white shadow-sm dark:bg-purple-700"
                      : "text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100",
                  )}
                >
                  <List className="h-3.5 w-3.5" strokeWidth={2} />
                  List
                </Link>
              </div>
              <Link
                href={`/marketing/content/new?date=${todayKey}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
              >
                <Plus className="h-4 w-4" strokeWidth={2.25} />
                New post
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildMonthHref(prevMonth.year, prevMonth.month)}
              aria-label="Previous month"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-cream-200 bg-white text-ink transition hover:border-purple-300 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:border-purple-700"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
            </Link>
            <h2 className="min-w-[10rem] text-center text-base font-bold text-ink dark:text-cream-100 sm:text-lg">
              {MONTH_LABELS[month - 1]} {year}
            </h2>
            <Link
              href={buildMonthHref(nextMonth.year, nextMonth.month)}
              aria-label="Next month"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-cream-200 bg-white text-ink transition hover:border-purple-300 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:border-purple-700"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
            <Link
              href={thisMonthHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cream-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-purple-300 hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400 dark:hover:border-purple-700 dark:hover:text-cream-100"
            >
              This month
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
            <StatPill
              label="Scheduled"
              value={monthStats.scheduled}
              active={statusFilter === "scheduled"}
              href={filterHref({ status: "scheduled" })}
            />
            <StatPill
              label="Drafts"
              value={monthStats.drafted}
              active={statusFilter === "drafted"}
              href={filterHref({ status: "drafted" })}
            />
            <StatPill
              label="Ideas"
              value={monthStats.idea}
              active={statusFilter === "idea"}
              href={filterHref({ status: "idea" })}
            />
            <StatPill
              label="Posted"
              value={monthStats.posted}
              active={statusFilter === "posted"}
              href={filterHref({ status: "posted" })}
            />
            <StatPill
              label="This month"
              value={monthStats.total}
              active={!statusFilter}
              href={resetHref}
            />
          </div>

          {backlogCount > 0 ? (
            <p className="text-xs text-ink-muted dark:text-cream-400">
              {backlogCount} post{backlogCount === 1 ? "" : "s"} without a
              scheduled date — open each entry to set a date.
            </p>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-purple-200/50 pt-3 dark:border-purple-900/30 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <nav
              aria-label="Filter by channel"
              className="flex flex-wrap items-center gap-1.5"
            >
              <Link
                href={resetHref}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                  !channelFilter && !statusFilter
                    ? "border-purple-600 bg-purple-600 text-white dark:border-purple-700 dark:bg-purple-700"
                    : "border-cream-200 bg-white text-ink-muted hover:border-purple-300 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400 dark:hover:border-purple-800",
                )}
              >
                All
              </Link>
              {(["tiktok", "instagram", "facebook"] as const).map((c) => (
                <ChannelFilterChip
                  key={c}
                  channel={c}
                  active={channelFilter === c}
                  href={filterHref({ channel: c })}
                />
              ))}
            </nav>

            <nav
              aria-label="Filter by status"
              className="flex flex-wrap gap-1.5"
            >
              {(["scheduled", "drafted", "idea", "posted"] as const).map((s) => (
                <Link
                  key={s}
                  href={filterHref({ status: s })}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition",
                    statusFilter === s
                      ? "border-purple-600 bg-purple-600 text-white dark:border-purple-700 dark:bg-purple-700"
                      : "border-cream-200 bg-white text-ink-muted hover:border-purple-300 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400 dark:hover:border-purple-800",
                  )}
                >
                  {STATUS_META[s].label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
