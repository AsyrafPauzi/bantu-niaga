import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContentCalendar } from "@/components/marketing/ContentCalendar";
import { ContentListMobile } from "@/components/marketing/ContentListMobile";
import { ContentCalendarAdaptive } from "./ContentCalendarAdaptive";
import type {
  ContentEntryRow,
  ContentMediaRow,
} from "@/components/marketing/types";

export const metadata = { title: "Content Calendar" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const MYT_OFFSET_MS = 8 * 3_600_000;

function nowInMyt(): { year: number; month: number } {
  const now = new Date();
  const myt = new Date(now.getTime() + MYT_OFFSET_MS);
  return { year: myt.getUTCFullYear(), month: myt.getUTCMonth() + 1 };
}

function clampMonth(year: number, month: number): { year: number; month: number } {
  let y = year;
  let m = month;
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

function parseInt10(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
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
          <h1 className="text-xl font-semibold text-ink dark:text-cream-100">
            Content Calendar
          </h1>
          <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
            You don't have access to the Marketing content calendar. Ask your
            owner or manager.
          </p>
        </CardBody>
      </Card>
    );
  }

  const raw = flattenParams(await searchParams);
  const requestedYear = parseInt10(raw.year);
  const requestedMonth = parseInt10(raw.month);

  const fallback = nowInMyt();
  const { year, month } =
    requestedYear !== null && requestedMonth !== null
      ? clampMonth(requestedYear, requestedMonth)
      : fallback;

  const supabase = await createSupabaseServerClient();

  // Window: [start of month MYT, start of next month MYT) expressed in UTC.
  const startUtc = new Date(Date.UTC(year, month - 1, 1, -8, 0, 0));
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endUtc = new Date(Date.UTC(nextYear, nextMonth - 1, 1, -8, 0, 0));

  const { data: scheduledRows, error } = await supabase
    .from("content_plan")
    .select(
      "id, business_id, channel, status, scheduled_at, hook, caption, " +
        "created_by, posted_at, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .gte("scheduled_at", startUtc.toISOString())
    .lt("scheduled_at", endUtc.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) {
    return (
      <Card>
        <CardBody className="py-6">
          <h1 className="text-xl font-semibold text-ink dark:text-cream-100">
            Content Calendar
          </h1>
          <p className="mt-2 text-sm text-status-danger">
            Failed to load entries: {error.message}
          </p>
        </CardBody>
      </Card>
    );
  }

  // Fetch unscheduled entries (drafts / ideas with no date) so the mobile
  // list can show them too. Hidden from the desktop calendar grid by
  // design (no scheduled_at = no cell to place them in).
  const { data: unscheduledRows } = await supabase
    .from("content_plan")
    .select(
      "id, business_id, channel, status, scheduled_at, hook, caption, " +
        "created_by, posted_at, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .is("scheduled_at", null)
    .in("status", ["idea", "drafted"])
    .order("created_at", { ascending: false })
    .limit(50);

  const scheduled = (scheduledRows ?? []) as unknown as ContentEntryRow[];
  const unscheduled = (unscheduledRows ?? []) as unknown as ContentEntryRow[];
  const allIds = [...scheduled, ...unscheduled].map((e) => e.id);

  let mediaByEntry: Record<string, ContentMediaRow[]> = {};
  if (allIds.length > 0) {
    const { data: media } = await supabase
      .from("content_plan_media")
      .select("content_plan_id, file_id, position")
      .eq("business_id", user.businessId)
      .in("content_plan_id", allIds)
      .order("position", { ascending: true });
    for (const row of media ?? []) {
      const k = row.content_plan_id as string;
      (mediaByEntry[k] ??= []).push({
        file_id: row.file_id as string,
        position: row.position as number,
      });
    }
  }

  const enrichedScheduled = scheduled.map((e) => ({
    ...e,
    media: mediaByEntry[e.id] ?? [],
  }));
  const enrichedUnscheduled = unscheduled.map((e) => ({
    ...e,
    media: mediaByEntry[e.id] ?? [],
  }));
  const mobileEntries = [...enrichedScheduled, ...enrichedUnscheduled];

  const prev = clampMonth(year, month - 1);
  const next = clampMonth(year, month + 1);
  const prevHref = `/marketing/content?year=${prev.year}&month=${prev.month}`;
  const nextHref = `/marketing/content?year=${next.year}&month=${next.month}`;

  const newEntryHref = (isoLocalDate: string) =>
    `/marketing/content/new?date=${isoLocalDate}`;
  const entryHref = (entryId: string) => `/marketing/content/${entryId}`;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
            Marketing
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink dark:text-cream-100">
            Content Calendar
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted dark:text-cream-400">
            Plan TikTok, Instagram, and Facebook posts on a desktop calendar.
            v1 is plan-only — no auto-post. Use the mobile list to capture
            ideas on the go.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/marketing/content/new">
            <Button size="sm">+ New entry</Button>
          </Link>
        </div>
      </header>

      <ContentCalendarAdaptive
        desktop={
          <ContentCalendar
            year={year}
            month={month}
            entries={enrichedScheduled}
            newEntryHref={newEntryHref}
            entryHref={entryHref}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        }
        mobile={
          <ContentListMobile
            entries={mobileEntries}
            entryHref={entryHref}
            newEntryHref="/marketing/content/new"
          />
        }
      />
    </div>
  );
}
