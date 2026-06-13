import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Content calendar" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface ContentRow {
  id: string;
  channel: "tiktok" | "instagram" | "facebook";
  status: "idea" | "drafted" | "scheduled" | "posted";
  scheduled_at: string | null;
  hook: string | null;
}

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

const CHANNEL_STYLE: Record<
  ContentRow["channel"],
  { label: string; chip: string; dot: string }
> = {
  tiktok: {
    label: "TikTok",
    chip: "bg-[#FFE5DF] text-[#8B2418] dark:bg-[#3A1714] dark:text-[#F0B0A6]",
    dot: "bg-[#8B2418] dark:bg-[#F0B0A6]",
  },
  instagram: {
    label: "Instagram",
    chip: "bg-[#FCE4D7] text-[#B35628] dark:bg-[#3A1F12] dark:text-[#F2B591]",
    dot: "bg-[#B35628] dark:bg-[#F2B591]",
  },
  facebook: {
    label: "Facebook",
    chip: "bg-[#FFE3B8] text-[#8C5C0A] dark:bg-[#3A2C12] dark:text-[#F5C97A]",
    dot: "bg-[#8C5C0A] dark:bg-[#F5C97A]",
  },
};

function flattenParams(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v.length > 0) out[k] = v[0];
  }
  return out;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function isoDayMyt(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
}

function dayOfMonth(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return 0;
  const myt = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
  return myt.getDate();
}

export default async function ContentCalendarPage({ searchParams }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "content")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to the Content calendar.
          </p>
        </CardBody>
      </Card>
    );
  }

  const raw = flattenParams(await searchParams);
  const now = new Date();
  const yearParam = Number.parseInt(raw.year ?? "", 10);
  const monthParam = Number.parseInt(raw.month ?? "", 10);
  const year = Number.isFinite(yearParam)
    ? clampInt(yearParam, 2000, 3000)
    : now.getFullYear();
  const month = Number.isFinite(monthParam)
    ? clampInt(monthParam, 1, 12)
    : now.getMonth() + 1;
  const channelFilter = (
    ["tiktok", "instagram", "facebook"] as const
  ).find((c) => c === raw.channel);
  const statusFilter = (
    ["idea", "drafted", "scheduled", "posted"] as const
  ).find((s) => s === raw.status);

  // Build UTC bounds for the calendar month. We over-fetch a 7-day pad on
  // each side so the grid (which renders the surrounding-month cells)
  // can include posts that fall there too.
  const startOfMonthUtc = new Date(Date.UTC(year, month - 1, 1));
  const endOfMonthUtc = new Date(Date.UTC(year, month, 1));
  const padStart = new Date(startOfMonthUtc.getTime() - 7 * 86_400_000);
  const padEnd = new Date(endOfMonthUtc.getTime() + 7 * 86_400_000);

  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("content_plan")
    .select("id, channel, status, scheduled_at, hook")
    .eq("business_id", user.businessId)
    .gte("scheduled_at", padStart.toISOString())
    .lt("scheduled_at", padEnd.toISOString())
    .order("scheduled_at", { ascending: true });
  if (channelFilter) q = q.eq("channel", channelFilter);
  if (statusFilter) q = q.eq("status", statusFilter);

  const { data, error } = await q;
  const rows = (data ?? []) as unknown as ContentRow[];

  // Build the calendar grid: 6 weeks of 7 days.
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = firstDay.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  type Cell = {
    dateKey: string;
    day: number;
    inMonth: boolean;
    isToday: boolean;
  };

  const todayKey = isoDayMyt(new Date());
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const dayOffset = i - firstWeekday;
    const date = new Date(year, month - 1, 1 + dayOffset);
    const day = date.getDate();
    const inMonth = date.getMonth() === month - 1;
    const dateKey = isoDayMyt(date);
    cells.push({ dateKey, day, inMonth, isToday: dateKey === todayKey });
  }

  // Group entries by yyyy-mm-dd in MYT
  const entriesByDate = new Map<string, ContentRow[]>();
  for (const row of rows) {
    if (!row.scheduled_at) continue;
    const key = isoDayMyt(new Date(row.scheduled_at));
    if (!entriesByDate.has(key)) entriesByDate.set(key, []);
    entriesByDate.get(key)!.push(row);
  }
  void dayOfMonth; // reserved for tooltip usage

  // Month navigation
  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const buildHref = (y: number, m: number) => {
    const u = new URLSearchParams();
    u.set("year", String(y));
    u.set("month", String(m));
    if (channelFilter) u.set("channel", channelFilter);
    if (statusFilter) u.set("status", statusFilter);
    return `/marketing/content?${u.toString()}`;
  };
  const filterHref = (
    next: { channel?: ContentRow["channel"]; status?: ContentRow["status"] },
  ) => {
    const u = new URLSearchParams();
    u.set("year", String(year));
    u.set("month", String(month));
    if (next.channel !== undefined) u.set("channel", next.channel);
    else if (channelFilter) u.set("channel", channelFilter);
    if (next.status !== undefined) u.set("status", next.status);
    else if (statusFilter) u.set("status", statusFilter);
    return `/marketing/content?${u.toString()}`;
  };
  const resetHref = `/marketing/content?year=${year}&month=${month}`;

  const totalThisMonth = rows.filter((r) => {
    if (!r.scheduled_at) return false;
    const key = isoDayMyt(new Date(r.scheduled_at));
    return key.startsWith(
      `${year}-${String(month).padStart(2, "0")}`,
    );
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketing"
        title="Content calendar"
        description={`${totalThisMonth} post${totalThisMonth === 1 ? "" : "s"} scheduled in ${MONTH_LABELS[month - 1]} ${year}.`}
        action={
          <Link
            href={`/marketing/content/new?date=${todayKey}`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            New post
          </Link>
        }
      />

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load content: {error.message}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-col gap-3 border-b border-cream-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-hairline-dark">
          <div className="flex items-center gap-3">
            <Link
              href={buildHref(prevMonth.year, prevMonth.month)}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-cream-300 bg-white text-ink-muted hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </Link>
            <h2 className="text-lg font-semibold text-ink dark:text-cream-100">
              {MONTH_LABELS[month - 1]} {year}
            </h2>
            <Link
              href={buildHref(nextMonth.year, nextMonth.month)}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-cream-300 bg-white text-ink-muted hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link
              href={`/marketing/content?year=${now.getFullYear()}&month=${now.getMonth() + 1}`}
              className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-cream-200 px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-ink dark:bg-hairline-dark dark:text-cream-400"
            >
              <Calendar className="h-3 w-3" strokeWidth={2} />
              Today
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <FilterChip href={resetHref} active={!channelFilter && !statusFilter}>
              All
            </FilterChip>
            {(["tiktok", "instagram", "facebook"] as const).map((c) => (
              <FilterChip
                key={c}
                href={filterHref({ channel: c })}
                active={channelFilter === c}
              >
                {CHANNEL_STYLE[c].label}
              </FilterChip>
            ))}
            {(["scheduled", "drafted", "idea", "posted"] as const).map((s) => (
              <FilterChip
                key={s}
                href={filterHref({ status: s })}
                active={statusFilter === s}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto p-2 sm:p-4">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <p key={d} className="px-2 py-1 text-center">
                  {d}
                </p>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-1.5">
              {cells.map((cell, idx) => {
                const dayPosts = entriesByDate.get(cell.dateKey) ?? [];
                return (
                  <Link
                    key={`${cell.dateKey}-${idx}`}
                    href={`/marketing/content/new?date=${cell.dateKey}`}
                    className={`group min-h-24 rounded-lg border p-1.5 transition-colors ${
                      cell.inMonth
                        ? "border-cream-200 bg-panel-light hover:border-brand-300 hover:bg-cream-100/60 dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-brand-700"
                        : "border-cream-200/60 bg-cream-50/40 dark:border-hairline-dark/60 dark:bg-panel-dark/40"
                    } ${cell.isToday ? "ring-2 ring-accent-400 ring-offset-1" : ""}`}
                  >
                    <p
                      className={`mb-1 text-xs font-semibold ${
                        cell.inMonth
                          ? cell.isToday
                            ? "text-accent-700 dark:text-accent-200"
                            : "text-ink dark:text-cream-100"
                          : "text-ink-subtle"
                      }`}
                    >
                      {cell.day}
                    </p>
                    <div className="space-y-1">
                      {dayPosts.slice(0, 3).map((p) => {
                        const style = CHANNEL_STYLE[p.channel];
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-semibold ${style.chip}`}
                          >
                            <span
                              className={`h-1 w-1 shrink-0 rounded-full ${style.dot}`}
                            />
                            <span className="truncate">
                              {p.hook ?? "Untitled"}
                            </span>
                          </div>
                        );
                      })}
                      {dayPosts.length > 3 ? (
                        <p className="text-[10px] font-semibold text-ink-subtle">
                          +{dayPosts.length - 3} more
                        </p>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-cream-200 px-5 py-3 text-xs dark:border-hairline-dark">
          {(["tiktok", "instagram", "facebook"] as const).map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 text-ink-muted dark:text-cream-400"
            >
              <span className={`h-2 w-2 rounded-full ${CHANNEL_STYLE[c].dot}`} />
              {CHANNEL_STYLE[c].label}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${
        active
          ? "bg-brand-500 text-white"
          : "border border-cream-300 bg-white text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
      }`}
    >
      {children}
    </Link>
  );
}
