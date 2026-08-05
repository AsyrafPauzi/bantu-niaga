import Link from "next/link";
import { Suspense } from "react";
import { LineChart, UsersRound } from "lucide-react";
import {
  loadBusinessesPage,
  loadBusinessesSummary,
} from "@/lib/super-admin/load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  Section,
  formatInt,
  formatMyr,
} from "@/components/super-admin/primitives";
import { BusinessesFilterBar } from "@/components/super-admin/BusinessesFilterBar";
import { SortableTh } from "@/components/super-admin/SortableTh";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  ADMIN_PAGE_SIZE_OPTIONS,
  parsePagination,
  withPageSizeSearchParam,
} from "@/lib/pagination";
import { parseBusinessesSort } from "@/lib/super-admin/table-sort";
import { tierBy, type TierKey } from "@/lib/settings/plans";
import type { HealthBand } from "@/lib/super-admin/health";
import { healthBandLabel } from "@/lib/super-admin/health";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z ]/g, "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function tierLabel(tier: TierKey): string {
  return tierBy(tier)?.label ?? tier;
}

function formatJoined(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return `${date} · today`;
  if (days === 1) return `${date} · 1d`;
  return `${date} · ${days}d`;
}

function subscriptionStatus(status: string): React.ReactNode {
  const map: Record<string, { dot: string; label: string }> = {
    active: { dot: "bg-status-success", label: "Active" },
    trial: { dot: "bg-status-info", label: "Trial" },
    past_due: { dot: "bg-status-warning", label: "Past due" },
    cancelled: { dot: "bg-status-danger", label: "Cancelled" },
  };
  const item = map[status] ?? { dot: "bg-ink-muted", label: status };
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
      {item.label}
    </span>
  );
}

function healthStatus(band?: HealthBand, score?: number): React.ReactNode {
  if (!band) {
    return <span className="text-[11px] text-ink-muted">No score</span>;
  }
  const dot =
    band === "healthy"
      ? "bg-status-success"
      : band === "watch"
        ? "bg-status-warning"
        : band === "at_risk"
          ? "bg-orange-500"
          : "bg-status-danger";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {healthBandLabel(band)}
      {typeof score === "number" ? ` · ${score}` : ""}
    </span>
  );
}

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function SuperAdminBusinesses({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pagination = parsePagination(params, {
    defaultPageSize: ADMIN_DEFAULT_PAGE_SIZE,
    allowedPageSizes: ADMIN_PAGE_SIZE_OPTIONS,
  });
  const sortState = parseBusinessesSort(params);
  const q = paramString(params.q);
  const tier = paramString(params.tier) || "all";
  const status = paramString(params.status) || "all";

  const [summary, { rows: businesses, total }] = await Promise.all([
    loadBusinessesSummary(),
    loadBusinessesPage({
      from: pagination.from,
      to: pagination.to,
      filters: {
        q: q || undefined,
        tier,
        status,
      },
      sort: sortState,
    }),
  ]);

  const filterActive = Boolean(q || tier !== "all" || status !== "all");
  const listSearchParams = withPageSizeSearchParam(
    {
      q: q || undefined,
      tier: tier !== "all" ? tier : undefined,
      status: status !== "all" ? status : undefined,
      sort: sortState.field !== "joined" ? sortState.field : undefined,
      order:
        sortState.field !== "joined" || sortState.order !== "desc"
          ? sortState.order
          : undefined,
    },
    pagination.pageSize,
  );
  const hasListState =
    filterActive ||
    sortState.field !== "joined" ||
    sortState.order !== "desc" ||
    pagination.pageSize !== ADMIN_DEFAULT_PAGE_SIZE;

  return (
    <>
      <PageTopbar
        title="Tenants"
        subtitle="Business accounts from the businesses table"
        right={
          <div className="flex items-center gap-2">
            <Link
              href="/super-admin/users"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100"
            >
              <UsersRound className="h-3.5 w-3.5" />
              Users
            </Link>
            <Link
              href="/super-admin/revenue"
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-muted"
            >
              <LineChart className="h-3.5 w-3.5" />
              Revenue
            </Link>
          </div>
        }
      />

      <PageBody>
        <div className="mb-3 grid grid-cols-4 gap-3">
          <KpiCard
            label="Total"
            value={formatInt(summary.total)}
            subtle="tenants"
            trend="flat"
          />
          <KpiCard
            label="Paying"
            value={formatInt(summary.paying)}
            subtle="non-starter, active"
            trend="up"
          />
          <KpiCard
            label="Plan MRR"
            value={formatMyr(summary.mrrMyr)}
            subtle="tier list price"
            trend="flat"
          />
          <KpiCard
            label="Trial / cancelled"
            value={formatInt(summary.trial + summary.cancelled)}
            subtle={`${summary.trial} trial · ${summary.cancelled} cancelled`}
            trend={summary.cancelled > 0 ? "down" : "flat"}
          />
        </div>

        <Suspense
          fallback={
            <div className="h-[88px] animate-pulse rounded-xl border border-cream-300 bg-white" />
          }
        >
          <BusinessesFilterBar
            initialQ={q}
            initialTier={tier}
            initialStatus={status}
          />
        </Suspense>

        <Section
          className="!p-4 !pb-0"
          title="Tenant directory"
          description={
            filterActive
              ? `${formatInt(total)} matching`
              : `${formatInt(total)} tenants`
          }
        >
          {businesses.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">
              {filterActive
                ? "No tenants match your filters."
                : "No tenants yet. New sign-ups will appear here automatically."}
            </p>
          ) : (
            <div className="-mx-4 mt-3 overflow-x-auto border-t border-cream-200">
              <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-cream-300 bg-cream-50/80 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    <SortableTh
                      label="Tenant"
                      field="tenant"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/businesses"
                      searchParams={listSearchParams}
                      className="px-4 py-2"
                    />
                    <SortableTh
                      label="Plan"
                      field="plan"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/businesses"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Subscription"
                      field="subscription"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/businesses"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Health"
                      field="health"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/businesses"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Users"
                      field="users"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/businesses"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Credits"
                      field="credits"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/businesses"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Joined"
                      field="joined"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/businesses"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {businesses.map((b) => (
                    <tr
                      key={b.id}
                      className="align-middle hover:bg-cream-50/60"
                    >
                      <td className="px-4 py-2 pr-3">
                        <Link
                          href={`/super-admin/businesses/${b.id}`}
                          className="flex min-w-0 items-center gap-2"
                        >
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand-100 text-[10px] font-bold text-brand-800">
                            {initials(b.name)}
                          </div>
                          <div className="min-w-0 leading-tight">
                            <p className="truncate font-medium text-brand-700 hover:underline">
                              {b.name}
                            </p>
                            <p className="truncate text-[11px] text-ink-muted">
                              {b.idcompany}
                              {b.state_code ? ` · ${b.state_code}` : ""}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-[11px] font-medium text-ink-muted">
                        {tierLabel(b.tier)}
                      </td>
                      <td className="px-3 py-2">
                        {subscriptionStatus(b.subscription_status)}
                      </td>
                      <td className="px-3 py-2">
                        {healthStatus(b.health_band, b.health_score)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink-muted">
                        {b.user_count ?? 0}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink-muted">
                        {formatInt(b.credit_balance)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[11px] text-ink-muted">
                        {formatJoined(b.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ListPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
            basePath="/super-admin/businesses"
            searchParams={hasListState ? listSearchParams : undefined}
            pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}
            defaultPageSize={ADMIN_DEFAULT_PAGE_SIZE}
          />
        </Section>
      </PageBody>
    </>
  );
}
