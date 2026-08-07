import type { ReactNode } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
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
  buildMonthHref: (y: number, m: number) => string;
  filterHref: (next: {
    channel?: ContentChannel;
    status?: ContentStatus;
  }) => string;
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
    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition",
    active
      ? "bg-white text-violet-900 shadow-sm"
      : "bg-white/15 text-white hover:bg-white/25",
  );
  const inner = (
    <>
      <span className="tabular-nums text-sm font-bold">{value}</span>
      <span className={active ? "text-violet-700" : "text-white/85"}>{label}</span>
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
        active
          ? "bg-white text-violet-900 shadow-sm"
          : "bg-white/10 text-white/90 hover:bg-white/20",
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
            ? "border-violet-100/80 bg-violet-50/40 dark:border-violet-900/30 dark:bg-violet-950/15"
            : "border-cream-200 bg-white dark:border-hairline-dark dark:bg-panel-dark"
          : "border-transparent bg-cream-50/30 opacity-50 dark:bg-panel-dark/20",
        cell.isToday && "ring-2 ring-violet-500 ring-offset-2 dark:ring-violet-400",
        cell.inMonth &&
          posts.length === 0 &&
          "hover:border-dashed hover:border-violet-300 dark:hover:border-violet-700",
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
    <div className="overflow-x-auto rounded-2xl border border-cream-200 bg-white p-3 shadow-card dark:border-hairline-dark dark:bg-panel-dark sm:p-4">
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
      <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-8 text-center dark:border-violet-900/40 dark:bg-violet-950/20">
        <p className="text-sm font-semibold text-ink dark:text-cream-100">
          No posts scheduled in {MONTH_LABELS[month - 1]}
        </p>
        <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
          Pick a day on desktop or tap New post to plan content.
        </p>
        <Link
          href={`/marketing/content/new?date=${todayKey}`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white"
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
          className="rounded-2xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark"
        >
          <header className="flex items-center justify-between border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
            <p className="text-sm font-bold text-ink dark:text-cream-100">
              {formatDayHeading(dateKey)}
            </p>
            {dateKey === todayKey ? (
              <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
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
  buildMonthHref,
  filterHref,
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

  return (
    <div className="space-y-4">
      <header
        className="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-violet-800 p-5 text-white shadow-lg dark:border-violet-900/50"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_80%_100%,rgba(0,0,0,0.15),transparent_50%)]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                Marketing · Content
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                Content calendar
              </h1>
            </div>
            <Link
              href={`/marketing/content/new?date=${todayKey}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-violet-800 shadow-sm transition hover:bg-violet-50"
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} />
              New post
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildMonthHref(prevMonth.year, prevMonth.month)}
              aria-label="Previous month"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 transition hover:bg-white/25"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
            </Link>
            <h2 className="min-w-[10rem] text-center text-lg font-bold">
              {MONTH_LABELS[month - 1]} {year}
            </h2>
            <Link
              href={buildMonthHref(nextMonth.year, nextMonth.month)}
              aria-label="Next month"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 transition hover:bg-white/25"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
            <Link
              href={`/marketing/content?year=${now.getFullYear()}&month=${now.getMonth() + 1}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/25"
            >
              <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
              This month
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
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
            <p className="text-xs text-white/80">
              {backlogCount} post{backlogCount === 1 ? "" : "s"} without a
              scheduled date — open each entry to set a date.
            </p>
          ) : null}

          <nav
            aria-label="Filter by channel"
            className="flex flex-wrap items-center gap-1.5"
          >
            <Link
              href={resetHref}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                !channelFilter && !statusFilter
                  ? "bg-white text-violet-900"
                  : "bg-white/10 text-white/90 hover:bg-white/20",
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
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition",
                  statusFilter === s
                    ? "bg-white text-violet-900"
                    : "bg-white/10 text-white/90 hover:bg-white/20",
                )}
              >
                {STATUS_META[s].label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {children}
    </div>
  );
}
