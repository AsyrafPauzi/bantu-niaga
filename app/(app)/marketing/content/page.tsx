import { redirect } from "next/navigation";
import { MarketingBackLink } from "@/components/marketing/MarketingBackLink";
import {
  ContentCalendarDesktop,
  ContentCalendarMobileList,
  ContentCalendarShell,
  type ContentCalendarViewMode,
} from "@/components/marketing/ContentCalendarView";
import { ContentCalendarAdaptive } from "@/app/(app)/marketing/content/ContentCalendarAdaptive";
import { Card, CardBody } from "@/components/ui/card";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildCalendarCells,
  computeMonthStats,
  groupByDate,
  isoDayMyt,
  type ContentCalendarRow,
  type ContentChannel,
  type ContentStatus,
} from "@/lib/marketing/content-calendar-shared";

export const metadata = { title: "Content calendar" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

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
  const viewMode: ContentCalendarViewMode =
    raw.view === "list" ? "list" : "calendar";

  const startOfMonthUtc = new Date(Date.UTC(year, month - 1, 1));
  const endOfMonthUtc = new Date(Date.UTC(year, month, 1));
  const padStart = new Date(startOfMonthUtc.getTime() - 7 * 86_400_000);
  const padEnd = new Date(endOfMonthUtc.getTime() + 7 * 86_400_000);

  const supabase = await createSupabaseServerClient();

  let calendarQuery = supabase
    .from("content_plan")
    .select("id, channel, status, scheduled_at, hook")
    .eq("business_id", user.businessId)
    .gte("scheduled_at", padStart.toISOString())
    .lt("scheduled_at", padEnd.toISOString())
    .order("scheduled_at", { ascending: true });
  if (channelFilter) calendarQuery = calendarQuery.eq("channel", channelFilter);
  if (statusFilter) calendarQuery = calendarQuery.eq("status", statusFilter);

  const [{ data, error }, backlogResult] = await Promise.all([
    calendarQuery,
    supabase
      .from("content_plan")
      .select("id", { count: "exact", head: true })
      .eq("business_id", user.businessId)
      .is("scheduled_at", null)
      .in("status", ["idea", "drafted", "scheduled"]),
  ]);

  const rows = (data ?? []) as unknown as ContentCalendarRow[];
  const backlogCount = backlogResult.count ?? 0;
  const todayKey = isoDayMyt(new Date());
  const cells = buildCalendarCells(year, month);
  const entriesByDate = groupByDate(rows);
  const monthStats = computeMonthStats(rows, year, month);

  const withView = (u: URLSearchParams) => {
    if (viewMode === "list") u.set("view", "list");
    return u;
  };

  const buildMonthHref = (y: number, m: number) => {
    const u = new URLSearchParams();
    u.set("year", String(y));
    u.set("month", String(m));
    if (channelFilter) u.set("channel", channelFilter);
    if (statusFilter) u.set("status", statusFilter);
    return `/marketing/content?${withView(u).toString()}`;
  };

  const filterHref = (next: {
    channel?: ContentChannel;
    status?: ContentStatus;
  }) => {
    const u = new URLSearchParams();
    u.set("year", String(year));
    u.set("month", String(month));
    if (next.channel !== undefined) u.set("channel", next.channel);
    else if (channelFilter) u.set("channel", channelFilter);
    if (next.status !== undefined) u.set("status", next.status);
    else if (statusFilter) u.set("status", statusFilter);
    return `/marketing/content?${withView(u).toString()}`;
  };

  const viewHref = (mode: ContentCalendarViewMode) => {
    const u = new URLSearchParams();
    u.set("year", String(year));
    u.set("month", String(month));
    if (channelFilter) u.set("channel", channelFilter);
    if (statusFilter) u.set("status", statusFilter);
    if (mode === "list") u.set("view", "list");
    return `/marketing/content?${u.toString()}`;
  };

  const resetHref = (() => {
    const u = new URLSearchParams();
    u.set("year", String(year));
    u.set("month", String(month));
    return `/marketing/content?${withView(u).toString()}`;
  })();

  const listView = (
    <ContentCalendarMobileList
      year={year}
      month={month}
      todayKey={todayKey}
      entriesByDate={entriesByDate}
    />
  );

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <MarketingBackLink />

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load content: {error.message}
          </CardBody>
        </Card>
      ) : null}

      <ContentCalendarShell
        year={year}
        month={month}
        todayKey={todayKey}
        monthStats={monthStats}
        backlogCount={backlogCount}
        channelFilter={channelFilter}
        statusFilter={statusFilter}
        viewMode={viewMode}
        buildMonthHref={buildMonthHref}
        filterHref={filterHref}
        viewHref={viewHref}
        resetHref={resetHref}
      >
        {viewMode === "list" ? (
          listView
        ) : (
          <ContentCalendarAdaptive
            desktop={
              <ContentCalendarDesktop
                year={year}
                month={month}
                todayKey={todayKey}
                cells={cells}
                entriesByDate={entriesByDate}
              />
            }
            mobile={listView}
          />
        )}
      </ContentCalendarShell>
    </div>
  );
}
