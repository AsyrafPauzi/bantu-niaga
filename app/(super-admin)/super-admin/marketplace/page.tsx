import Link from "next/link";
import {
  Calculator,
  CalendarClock,
  CreditCard,
  Database,
  HardDrive,
  MessageSquare,
  Receipt,
  Sparkles,
  Store,
  Truck,
  UserPlus2,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { loadMarketplaceAdmin } from "@/lib/super-admin/load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  Section,
  StatusPill,
  formatMyr,
  formatInt,
} from "@/components/super-admin/primitives";
import { MarketplaceToggle } from "@/components/super-admin/MarketplaceToggle";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  ADMIN_PAGE_SIZE_OPTIONS,
  paginateArray,
  parsePagination,
  withPageSizeSearchParam,
} from "@/lib/pagination";
import { PILLAR_LABEL, PILLARS, type Pillar } from "@/lib/auth/entitlements";

export const dynamic = "force-dynamic";

const EXTRA_PILLAR_LABEL: Record<string, string> = {
  ai: "AI agents",
  cross: "Cross-cutting",
};

const FILTERABLE_PILLARS = [...PILLARS, "ai", "cross"] as const;
type FilterablePillar = (typeof FILTERABLE_PILLARS)[number];
type PillarFilter = "all" | FilterablePillar;

function paramString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parsePillarFilter(
  params: Record<string, string | string[] | undefined>,
): PillarFilter {
  const raw = paramString(params.pillar);
  if (
    raw &&
    (FILTERABLE_PILLARS as readonly string[]).includes(raw)
  ) {
    return raw as FilterablePillar;
  }
  return "all";
}

function pillarLabel(pillar: string): string {
  if ((PILLARS as readonly string[]).includes(pillar)) {
    return PILLAR_LABEL[pillar as Pillar];
  }
  return EXTRA_PILLAR_LABEL[pillar] ?? pillar;
}

function marketplaceHref(
  pillar: PillarFilter,
  pageSize: number,
): string {
  const params = new URLSearchParams();
  if (pillar !== "all") params.set("pillar", pillar);
  if (pageSize !== ADMIN_DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(pageSize));
  }
  const query = params.toString();
  return query
    ? `/super-admin/marketplace?${query}`
    : "/super-admin/marketplace";
}

const ICONS: Record<string, LucideIcon> = {
  receipt: Receipt,
  sparkles: Sparkles,
  zap: Zap,
  "hard-drive": HardDrive,
  "user-plus-2": UserPlus2,
  database: Database,
  "calendar-clock": CalendarClock,
  "credit-card": CreditCard,
  "message-square": MessageSquare,
  users: Users,
  truck: Truck,
  calculator: Calculator,
  store: Store,
};

function priceLabel(
  cents: number,
  cadence: "monthly" | "yearly" | "one_time" | "included",
): string {
  if (cadence === "included") return "Included";
  const myr = cents / 100;
  if (cadence === "monthly") return `${formatMyr(myr)} / month`;
  if (cadence === "yearly") return `${formatMyr(myr)} / year`;
  return `${formatMyr(myr)} one-time`;
}

function statusToPill(status: "live" | "draft" | "disabled") {
  switch (status) {
    case "live":
      return <StatusPill tone="success" label="Live" />;
    case "draft":
      return <StatusPill tone="warning" label="Draft" />;
    case "disabled":
      return <StatusPill tone="muted" label="Disabled" />;
  }
}

export default async function SuperAdminMarketplace({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pillarFilter = parsePillarFilter(params);
  const pagination = parsePagination(params, {
    defaultPageSize: ADMIN_DEFAULT_PAGE_SIZE,
    allowedPageSizes: ADMIN_PAGE_SIZE_OPTIONS,
  });
  const listSearchParams = withPageSizeSearchParam(
    pillarFilter !== "all" ? { pillar: pillarFilter } : {},
    pagination.pageSize,
  );

  const addons = await loadMarketplaceAdmin();
  const filteredAddons =
    pillarFilter === "all"
      ? addons
      : addons.filter((a) => a.pillar === pillarFilter);
  const { items: pageAddons, total } = paginateArray(
    filteredAddons,
    pagination.page,
    pagination.pageSize,
  );

  const liveCount = addons.filter((a) => a.status === "live").length;
  const totalSubs = addons.reduce((s, a) => s + a.active_subscriptions, 0);
  const mrr = addons.reduce((s, a) => s + a.mrr_myr, 0);
  const totalAttachPct =
    addons.length > 0
      ? Math.round(
          (totalSubs / Math.max(1, addons.length * 4)) * 1000,
        ) / 10
      : 0;

  const pillarTabs: { key: PillarFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: addons.length },
    ...FILTERABLE_PILLARS.filter((p) =>
      addons.some((a) => a.pillar === p),
    ).map((p) => ({
      key: p as FilterablePillar,
      label: pillarLabel(p),
      count: addons.filter((a) => a.pillar === p).length,
    })),
  ];

  const catalogDescription =
    pillarFilter === "all"
      ? `${total} items · click an add-on for feature details`
      : `${total} in ${pillarLabel(pillarFilter)} · click an add-on for feature details`;

  return (
    <>
      <PageTopbar
        title="Marketplace"
        subtitle={`${liveCount} live · ${addons.length - liveCount} hidden`}
      />

      <PageBody>
        <div className="flex flex-wrap gap-4">
          <KpiCard
            label="Active add-ons"
            value={liveCount}
            delta={`${addons.length} catalog total`}
            trend="up"
          />
          <KpiCard
            label="Add-on MRR"
            value={formatMyr(Math.round(mrr))}
            delta="from tenant activations"
            trend="up"
          />
          <KpiCard
            label="Total subscriptions"
            value={formatInt(totalSubs)}
            subtle="across all tenants"
          />
          <KpiCard
            label="Avg attach rate"
            value={`${totalAttachPct}%`}
            subtle="rough tenant coverage"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pillarTabs.map((t) => {
            const active = t.key === pillarFilter;
            return (
              <Link
                key={t.key}
                href={marketplaceHref(t.key, pagination.pageSize)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? "border-ink bg-ink text-white"
                    : "border-cream-300 bg-white text-ink hover:bg-cream-100"
                }`}
              >
                {t.label}
                <span
                  className={`rounded-sm px-1 text-[10px] font-bold ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-cream-200 text-ink-muted"
                  }`}
                >
                  {t.count}
                </span>
              </Link>
            );
          })}
        </div>

        <Section
          className="!p-4 !pb-0"
          title="Add-on catalog"
          description={catalogDescription}
        >
          {addons.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">
              Catalog is empty. Add-ons are seeded via database migrations.
            </p>
          ) : filteredAddons.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">
              No add-ons in {pillarLabel(pillarFilter)}.{" "}
              <Link
                href="/super-admin/marketplace"
                className="font-semibold text-brand-600 hover:text-brand-700"
              >
                Show all
              </Link>
            </p>
          ) : (
            <>
              <div className="-mx-4 mt-3 overflow-x-auto border-t border-cream-200">
                <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-cream-300 bg-cream-50/80 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      <th className="min-w-[260px] px-4 py-2">Add-on</th>
                      <th className="whitespace-nowrap px-3 py-2">Module</th>
                      <th className="whitespace-nowrap px-3 py-2">Price</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">
                        Active subs
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">
                        MRR
                      </th>
                      <th className="whitespace-nowrap px-3 py-2">Status</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">
                        Live
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageAddons.map((a) => {
                      const Icon = ICONS[a.icon] ?? Store;
                      return (
                        <tr
                          key={a.id}
                          className="border-b border-cream-200 last:border-b-0 hover:bg-cream-50/60"
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/super-admin/marketplace/${a.id}`}
                              className="flex min-w-0 items-center gap-2.5"
                            >
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-100 text-brand-700">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 leading-tight">
                                <div className="flex items-center gap-1.5">
                                  <p className="truncate text-sm font-semibold text-brand-700 hover:underline">
                                    {a.name}
                                  </p>
                                {a.is_featured && (
                                  <span className="inline-flex shrink-0 rounded-sm bg-accent-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-700">
                                    Featured
                                  </span>
                                )}
                                {a.is_coming_soon && (
                                  <span className="inline-flex shrink-0 rounded-sm bg-cream-200 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-muted">
                                    Soon
                                  </span>
                                )}
                                </div>
                                <p className="line-clamp-1 text-[11px] text-ink-muted">
                                  {a.short_desc}
                                </p>
                              </div>
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-ink">
                            {pillarLabel(a.pillar)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs font-medium tabular-nums text-ink">
                            {priceLabel(a.price_cents, a.cadence)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-semibold tabular-nums text-ink">
                            {formatInt(a.active_subscriptions)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-semibold tabular-nums text-ink">
                            {formatMyr(Math.round(a.mrr_myr))}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {statusToPill(a.status)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <div className="flex justify-end">
                              <MarketplaceToggle
                                addonId={a.id}
                                initialStatus={a.status}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ListPagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={total}
                basePath="/super-admin/marketplace"
                searchParams={listSearchParams}
                defaultPageSize={ADMIN_DEFAULT_PAGE_SIZE}
                pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}
                hideOnSinglePage={false}
              />
            </>
          )}
        </Section>
      </PageBody>
    </>
  );
}
