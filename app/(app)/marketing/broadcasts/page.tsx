import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, MessageCircle, Plus, Send } from "lucide-react";
import { MarketingSubpageShell } from "@/components/marketing/MarketingSubpageShell";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
  ModuleListPanelHeader,
  ModuleListTable,
  ModuleListTableBody,
  ModuleListTableHead,
  MODULE_LIST_TABLE_ROW_CLASS,
} from "@/components/dashboard/module-list-panel";
import { ModuleListFilterChipLink } from "@/components/dashboard/module-list-search";
import { ListPagination } from "@/components/ui/list-pagination";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { parsePagination } from "@/lib/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BroadcastRow } from "@/lib/marketing/broadcasts";
import { broadcastsSubpageHero } from "@/lib/marketing/subpage-hero";

export const metadata = { title: "Broadcasts" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const BROADCAST_STATUS_FILTERS = [
  "draft",
  "sending",
  "sent",
  "partially_sent",
  "failed",
] as const;

type BroadcastStatus = (typeof BROADCAST_STATUS_FILTERS)[number];

interface ListRow extends BroadcastRow {
  customer_segments: { id: string; name: string } | null;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  const days = Math.round(diffSec / 86400);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function statusToneOf(status: BroadcastRow["status"]) {
  switch (status) {
    case "draft":
      return "neutral" as const;
    case "sending":
      return "warning" as const;
    case "sent":
      return "success" as const;
    case "partially_sent":
      return "accent" as const;
    case "failed":
      return "danger" as const;
  }
}

export default async function MarketingBroadcastsPage({
  searchParams,
}: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "broadcasts")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to Marketing broadcasts.
          </p>
        </CardBody>
      </Card>
    );
  }

  const params = await searchParams;
  const pagination = parsePagination(params, { defaultPageSize: 10 });
  const statusFilter = BROADCAST_STATUS_FILTERS.find((s) => s === params.status);

  const supabase = await createSupabaseServerClient();

  // Summary counts across all broadcasts (for hero + filter chips).
  const { data: statusRows } = await supabase
    .from("broadcasts")
    .select("status, total_recipients")
    .eq("business_id", user.businessId);

  const allRows = statusRows ?? [];
  const countByStatus = Object.fromEntries(
    BROADCAST_STATUS_FILTERS.map((s) => [s, 0]),
  ) as Record<BroadcastStatus, number>;
  let recipientsTotal = 0;
  for (const row of allRows) {
    const status = row.status as BroadcastStatus;
    if (status in countByStatus) countByStatus[status] += 1;
    recipientsTotal += Number(row.total_recipients ?? 0);
  }
  const totalAll = allRows.length;
  const draftCount = countByStatus.draft;
  const sentCount = countByStatus.sent + countByStatus.partially_sent;

  let listQuery = supabase
    .from("broadcasts")
    .select(
      "id, business_id, name, channel, segment_id, subject, message_template, " +
        "coupon_id, status, total_recipients, sent_count, failed_count, " +
        "scheduled_at, sent_at, created_by, created_at, updated_at, " +
        "customer_segments:segment_id (id, name)",
      { count: "exact" },
    )
    .eq("business_id", user.businessId)
    .order("created_at", { ascending: false })
    .range(pagination.from, pagination.to);

  if (statusFilter) {
    listQuery = listQuery.eq("status", statusFilter);
  }

  const { data: dataRaw, error, count } = await listQuery;
  const filtered = (dataRaw ?? []) as unknown as ListRow[];
  const listTotal = count ?? filtered.length;

  function statusHref(status: BroadcastStatus | null) {
    return status
      ? `/marketing/broadcasts?status=${status}`
      : "/marketing/broadcasts";
  }

  const hero = broadcastsSubpageHero({
    total: totalAll,
    draftCount,
    sentCount,
  });

  return (
    <MarketingSubpageShell
      headline={hero.headline}
      subcopy={hero.subcopy}
      variant={hero.variant}
      action={
        <Link
          href="/marketing/broadcasts/new"
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          New broadcast
        </Link>
      }
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="Total"
            value={totalAll}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
          <ModuleHeroStat
            label="Drafts"
            value={draftCount}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Sent"
            value={sentCount}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="Recipients"
            value={recipientsTotal}
            iconClassName="text-amber-700 dark:text-amber-300"
          />
        </div>
      }
    >
      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load broadcasts: {error.message}
          </CardBody>
        </Card>
      ) : null}

      <ModuleListPanel>
        <ModuleListPanelHeader
          title="Broadcasts"
          subtitle={`${listTotal} shown`}
        />
        <ModuleListPanelFilters>
          <nav
            aria-label="Filter broadcasts"
            className="flex flex-wrap gap-2"
          >
            <ModuleListFilterChipLink
              href={statusHref(null)}
              active={!statusFilter}
              accent="violet"
              label="All"
              count={totalAll}
            />
            {BROADCAST_STATUS_FILTERS.map((s) => (
              <ModuleListFilterChipLink
                key={s}
                href={statusHref(s)}
                active={statusFilter === s}
                accent="violet"
                label={s.replace("_", " ")}
                count={countByStatus[s]}
              />
            ))}
          </nav>
        </ModuleListPanelFilters>
        <ModuleListTable>
          <ModuleListTableHead>
            <tr>
              <th className="px-5 py-3 text-left">Broadcast</th>
              <th className="px-3 py-3 text-left">Channel</th>
              <th className="px-3 py-3 text-left">Segment</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-right">Sent / Total</th>
              <th className="px-5 py-3 text-right">Created</th>
            </tr>
          </ModuleListTableHead>
          <ModuleListTableBody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-sm text-ink-muted dark:text-cream-400"
                >
                  <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-accent-700 dark:bg-accent-700/20 dark:text-accent-200">
                    <Send className="h-6 w-6" strokeWidth={2} />
                  </span>
                  <p className="text-base font-semibold text-ink dark:text-cream-100">
                    No broadcasts yet
                  </p>
                  <p className="mx-auto mt-1 max-w-md">
                    Build your first WhatsApp or email blast against any saved
                    segment.
                  </p>
                  <Link
                    href="/marketing/broadcasts/new"
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.25} />
                    New broadcast
                  </Link>
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className={MODULE_LIST_TABLE_ROW_CLASS}>
                  <td className="px-5 py-3">
                    <Link
                      href={`/marketing/broadcasts/${row.id}`}
                      className="font-semibold text-ink hover:text-brand-700 dark:text-cream-100"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted dark:text-cream-400">
                      {row.channel === "whatsapp_ctc" ? (
                        <MessageCircle
                          className="h-4 w-4 text-[#25D366]"
                          strokeWidth={2}
                        />
                      ) : (
                        <Mail
                          className="h-4 w-4 text-brand-700 dark:text-brand-200"
                          strokeWidth={2}
                        />
                      )}
                      {row.channel === "whatsapp_ctc"
                        ? "WhatsApp"
                        : "Email"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-ink-muted dark:text-cream-400">
                    {row.customer_segments?.name ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill tone={statusToneOf(row.status)}>
                      {row.status.replace("_", " ")}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-ink dark:text-cream-100">
                    {row.sent_count}
                    {" / "}
                    {row.total_recipients}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-ink-muted dark:text-cream-400">
                    {relativeTime(row.created_at)}
                  </td>
                </tr>
              ))
            )}
          </ModuleListTableBody>
        </ModuleListTable>
        <ListPagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={listTotal}
          basePath="/marketing/broadcasts"
          searchParams={{
            status: statusFilter ?? undefined,
          }}
          pageSizeOptions={[10, 25, 50]}
          className="border-t border-cream-200 dark:border-hairline-dark"
        />
      </ModuleListPanel>
    </MarketingSubpageShell>
  );
}
