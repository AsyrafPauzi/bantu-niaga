import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Ticket } from "lucide-react";
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
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMyr } from "@/lib/marketing/metrics";
import { CouponStatusToggle } from "./status-toggle";
import { couponsSubpageHero } from "@/lib/marketing/subpage-hero";
import { parsePagination } from "@/lib/pagination";

export const metadata = { title: "Coupons" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface CouponListRow {
  id: string;
  code: string;
  name: string | null;
  type: "PCT" | "AMT";
  value: number | string;
  min_subtotal_myr: number | string;
  valid_from: string;
  valid_until: string | null;
  total_limit: number | null;
  per_customer_limit: number;
  status: "active" | "paused" | "expired";
  redeemed_count: number;
}

function formatValidWindow(from: string, until: string | null): string {
  const opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" };
  const f = new Date(from).toLocaleDateString("en-MY", opts);
  if (!until) return `From ${f}`;
  const u = new Date(until).toLocaleDateString("en-MY", opts);
  return `${f} → ${u}`;
}

function formatTypeValue(type: "PCT" | "AMT", value: number | string): string {
  const n = Number(value);
  if (type === "PCT") return `${n}% off`;
  return `${formatMyr(n)} off`;
}

export default async function MarketingCouponsPage({
  searchParams,
}: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "coupons")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to Marketing coupons.
          </p>
        </CardBody>
      </Card>
    );
  }

  const params = await searchParams;
  const pagination = parsePagination(params, {
    defaultPageSize: 10,
    allowedPageSizes: [10, 25, 50],
  });
  const statusParam = typeof params.status === "string" ? params.status : null;
  const statusFilter =
    statusParam === "active" ||
    statusParam === "paused" ||
    statusParam === "expired"
      ? statusParam
      : null;

  const supabase = await createSupabaseServerClient();

  const { data: statusRows } = await supabase
    .from("coupons")
    .select("status, redeemed_count")
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  const allRows = statusRows ?? [];
  const activeCount = allRows.filter((r) => r.status === "active").length;
  const pausedCount = allRows.filter((r) => r.status === "paused").length;
  const expiredCount = allRows.filter((r) => r.status === "expired").length;
  const redeemedTotal = allRows.reduce(
    (n, r) => n + Number(r.redeemed_count ?? 0),
    0,
  );
  const totalAll = allRows.length;

  let listQuery = supabase
    .from("coupons")
    .select(
      "id, code, name, type, value, min_subtotal_myr, valid_from, valid_until, total_limit, per_customer_limit, status, redeemed_count",
      { count: "exact" },
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(pagination.from, pagination.to);

  if (statusFilter) {
    listQuery = listQuery.eq("status", statusFilter);
  }

  const { data, error, count } = await listQuery;
  const rows = (data ?? []) as CouponListRow[];
  const listTotal = count ?? rows.length;

  function statusHref(status: CouponListRow["status"] | null) {
    return status
      ? `/marketing/coupons?status=${status}`
      : "/marketing/coupons";
  }

  const hero = couponsSubpageHero({
    total: totalAll,
    activeCount,
    redeemedTotal,
  });

  return (
    <MarketingSubpageShell
      headline={hero.headline}
      subcopy={hero.subcopy}
      variant={hero.variant}
      action={
        <Link
          href="/marketing/coupons/new"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          New coupon
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
            label="Active"
            value={activeCount}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="Redemptions"
            value={redeemedTotal.toLocaleString("en-MY")}
            iconClassName="text-amber-700 dark:text-amber-300"
          />
          <ModuleHeroStat
            label="Paused"
            value={pausedCount}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
        </div>
      }
    >
      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load coupons: {error.message}
          </CardBody>
        </Card>
      ) : null}

      <ModuleListPanel>
        <ModuleListPanelHeader
          title="Promo codes"
          subtitle={
            listTotal === 0
              ? "No codes yet"
              : `${listTotal} matching · page ${pagination.page}`
          }
        />
        <ModuleListPanelFilters>
          <nav aria-label="Filter coupons" className="flex flex-wrap gap-2">
            <ModuleListFilterChipLink
              href={statusHref(null)}
              active={!statusFilter}
              accent="violet"
              label="All"
              count={totalAll}
            />
            <ModuleListFilterChipLink
              href={statusHref("active")}
              active={statusFilter === "active"}
              accent="violet"
              label="Active"
              count={activeCount}
            />
            <ModuleListFilterChipLink
              href={statusHref("paused")}
              active={statusFilter === "paused"}
              accent="violet"
              label="Paused"
              count={pausedCount}
            />
            <ModuleListFilterChipLink
              href={statusHref("expired")}
              active={statusFilter === "expired"}
              accent="violet"
              label="Expired"
              count={expiredCount}
            />
          </nav>
        </ModuleListPanelFilters>
        <ModuleListTable>
          <ModuleListTableHead>
            <tr>
              <th className="px-5 py-3 text-left">Code</th>
              <th className="px-3 py-3 text-left">Type / value</th>
              <th className="px-3 py-3 text-left">Valid window</th>
              <th className="px-3 py-3 text-right">Redeemed</th>
              <th className="px-5 py-3 text-right">Status</th>
            </tr>
          </ModuleListTableHead>
          <ModuleListTableBody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-10 text-center text-sm text-ink-muted dark:text-cream-400"
                >
                  {statusFilter
                    ? `No ${statusFilter} coupons.`
                    : "No coupons yet. Create your first promo code to start tracking redemptions."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={MODULE_LIST_TABLE_ROW_CLASS}>
                  <td className="px-5 py-3">
                    <Link
                      href={`/marketing/coupons/${row.id}`}
                      className="flex items-center gap-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700 dark:bg-accent-700/30 dark:text-accent-200">
                        <Ticket className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-base font-bold uppercase tracking-wider text-ink hover:text-brand-700 dark:text-cream-100">
                          {row.code}
                        </p>
                        {row.name ? (
                          <p className="text-xs text-ink-muted dark:text-cream-400">
                            {row.name}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-ink dark:text-cream-100">
                      {formatTypeValue(row.type, row.value)}
                    </p>
                    {Number(row.min_subtotal_myr) > 0 ? (
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        Min subtotal {formatMyr(Number(row.min_subtotal_myr))}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-xs text-ink-muted dark:text-cream-400">
                    {formatValidWindow(row.valid_from, row.valid_until)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink dark:text-cream-100">
                    {row.redeemed_count.toLocaleString()}
                    <span className="text-ink-muted dark:text-cream-400">
                      {row.total_limit != null
                        ? ` / ${row.total_limit.toLocaleString()}`
                        : ""}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <CouponStatusToggle id={row.id} status={row.status} />
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
          basePath="/marketing/coupons"
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
