import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Search,
  Star,
  Upload,
  Users,
} from "lucide-react";
import { BulkAutoTagBanner } from "@/components/marketing/BulkAutoTagBanner";
import { CustomerListEmptyState } from "@/components/marketing/CustomerListEmptyState";
import { CustomerListSelectable } from "@/components/marketing/CustomerListSelectable";
import { CustomerQuickAddBar } from "@/components/marketing/CustomerQuickAddBar";
import { MarketingSubpageShell } from "@/components/marketing/MarketingSubpageShell";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
  ModuleListPanelFooter,
} from "@/components/dashboard/module-list-panel";
import { Card, CardBody } from "@/components/ui/card";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { cn } from "@/lib/utils/cn";
import { buildCustomersExportUrl } from "@/lib/marketing/customers-export-url";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListQuerySchema } from "@/lib/marketing/schemas";
import { formatCount } from "@/lib/marketing/metrics";
import { getKpiSnapshot } from "@/lib/marketing/dashboard-queries";
import { customersSubpageHero } from "@/lib/marketing/subpage-hero";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface CustomerListRow {
  id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  source: string | null;
  manual_tags: string[];
  auto_tags: string[];
  total_spend_myr: number;
  order_count: number;
  last_purchase_at: string | null;
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

export default async function CustomersPage({ searchParams }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "customers")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to the Marketing CRM.
          </p>
        </CardBody>
      </Card>
    );
  }

  const raw = flattenParams(await searchParams);
  const parsed = ListQuerySchema.safeParse(raw);
  const query = parsed.success
    ? parsed.data
    : ListQuerySchema.parse({}); // defaults
  const parseError = !parsed.success;
  const hasFilters = Boolean(
    query.q ||
      (query.tags && query.tags.length > 0) ||
      query.source ||
      typeof query.min_spend === "number" ||
      typeof query.max_spend === "number",
  );

  const exportHref = buildCustomersExportUrl({
    q: query.q,
    tags: query.tags?.join(","),
    source: query.source,
    min_spend:
      typeof query.min_spend === "number" ? String(query.min_spend) : undefined,
    max_spend:
      typeof query.max_spend === "number" ? String(query.max_spend) : undefined,
  });

  const supabase = await createSupabaseServerClient();

  // KPIs across the whole book — independent of filters.
  const snapshot = await getKpiSnapshot(supabase, user.businessId);

  let q = supabase
    .from("customers")
    .select(
      "id, name, phone_e164, email, source, manual_tags, auto_tags, " +
        "total_spend_myr, order_count, last_purchase_at",
      { count: "exact" },
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .is("merged_into_id", null);

  if (query.q) {
    const safe = query.q.replace(/[\\*,()]/g, "");
    q = q.or(`name.ilike.*${safe}*,phone_e164.ilike.*${safe}*`);
  }
  if (query.tags && query.tags.length > 0) {
    const tagList = `{${query.tags
      .map((t) => `"${t.replace(/"/g, '\\"')}"`)
      .join(",")}}`;
    q = q.or(`auto_tags.ov.${tagList},manual_tags.ov.${tagList}`);
  }
  if (query.source) q = q.eq("source", query.source);
  if (typeof query.min_spend === "number")
    q = q.gte("total_spend_myr", query.min_spend);
  if (typeof query.max_spend === "number")
    q = q.lte("total_spend_myr", query.max_spend);

  q = q
    .order(query.sort, { ascending: query.order === "asc", nullsFirst: false })
    .range(
      (query.page - 1) * query.pageSize,
      query.page * query.pageSize - 1,
    );

  const { data, count, error } = await q;

  const rows = (data ?? []) as unknown as CustomerListRow[];
  const total = count ?? 0;
  const pageStart = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const pageEnd = Math.min(total, query.page * query.pageSize);
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));

  // Build base href that preserves filters between pages.
  const baseParams = new URLSearchParams();
  if (query.q) baseParams.set("q", query.q);
  if (query.tags && query.tags.length > 0)
    baseParams.set("tags", query.tags.join(","));
  if (query.source) baseParams.set("source", query.source);
  if (typeof query.min_spend === "number")
    baseParams.set("min_spend", String(query.min_spend));
  if (typeof query.max_spend === "number")
    baseParams.set("max_spend", String(query.max_spend));
  baseParams.set("pageSize", String(query.pageSize));
  baseParams.set("sort", query.sort);
  baseParams.set("order", query.order);
  const pageHref = (p: number) => {
    const u = new URLSearchParams(baseParams);
    u.set("page", String(p));
    return `/marketing/customers?${u.toString()}`;
  };

  const sortHref = (field: typeof query.sort) => {
    const u = new URLSearchParams(baseParams);
    u.delete("page");
    if (query.sort === field) {
      u.set("order", query.order === "asc" ? "desc" : "asc");
    } else {
      u.set("sort", field);
      u.set("order", field === "name" ? "asc" : "desc");
    }
    return `/marketing/customers?${u.toString()}`;
  };

  const tagFilterHref = (tag: string | null) => {
    const u = new URLSearchParams(baseParams);
    u.delete("page");
    if (tag) u.set("tags", tag);
    else u.delete("tags");
    return `/marketing/customers?${u.toString()}`;
  };

  const activeTag =
    query.tags && query.tags.length === 1 ? query.tags[0] : query.tags?.length ? "multi" : null;

  const TAG_FILTERS = [
    { slug: null as string | null, label: "All", count: snapshot.totalCustomers },
    { slug: "vip", label: "VIP", count: snapshot.vipCount },
    { slug: "repeat", label: "Repeat", count: snapshot.repeatCount },
    { slug: "new", label: "New", count: snapshot.newThisMonth },
    { slug: "at-risk", label: "At-risk", count: snapshot.atRiskCount },
    { slug: "dormant", label: "Dormant", count: snapshot.dormantCount },
  ] as const;

  const hero = customersSubpageHero(snapshot);
  const filteredLabel =
    query.q || (query.tags && query.tags.length > 0) || query.source
      ? `${formatCount(total)} match${total === 1 ? "" : "es"}`
      : null;

  return (
    <MarketingSubpageShell
      headline={hero.headline}
      subcopy={hero.subcopy}
      variant={hero.variant}
      cta={
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/marketing/customers/import"
            className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-violet-800 shadow-sm transition-colors hover:bg-white dark:border-violet-900/50 dark:bg-panel-dark/80 dark:text-violet-200"
          >
            <Upload className="h-4 w-4" strokeWidth={2} />
            Import CSV
          </Link>
          <Link
            href="/marketing/customers/new"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New customer
          </Link>
        </div>
      }
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="In CRM"
            value={formatCount(snapshot.totalCustomers)}
            hint={
              snapshot.newThisMonth > 0
                ? `+${formatCount(snapshot.newThisMonth)} this month`
                : "all active"
            }
            icon={Users}
            iconClassName="text-violet-700 dark:text-violet-300"
            href="/marketing/customers"
          />
          <ModuleHeroStat
            label="VIP"
            value={formatCount(snapshot.vipCount)}
            hint={snapshot.vipCount > 0 ? "top spenders" : "none yet"}
            icon={Star}
            iconClassName="text-amber-700 dark:text-amber-300"
            href="/marketing/customers?tags=vip"
          />
          <ModuleHeroStat
            label="Dormant"
            value={formatCount(snapshot.dormantCount)}
            hint={snapshot.dormantCount > 0 ? "win-back targets" : "all active"}
            icon={Users}
            iconClassName="text-slate-600 dark:text-slate-300"
            href="/marketing/customers?tags=dormant"
          />
          <ModuleHeroStat
            label="At-risk"
            value={formatCount(snapshot.atRiskCount)}
            hint={snapshot.atRiskCount > 0 ? "needs care" : "all clear"}
            icon={AlertTriangle}
            iconClassName="text-rose-700 dark:text-rose-300"
            href="/marketing/customers?tags=at-risk"
          />
        </div>
      }
    >
      {snapshot.totalCustomers > 0 ? <BulkAutoTagBanner /> : null}

      <div className="space-y-4">
        <CustomerQuickAddBar />

        {snapshot.totalCustomers === 0 && !hasFilters ? (
          <CustomerListEmptyState />
        ) : null}

        {parseError ? (
          <Card>
            <CardBody className="text-sm text-status-danger">
              Invalid filter values in URL — defaults applied.
            </CardBody>
          </Card>
        ) : null}

        {error ? (
          <Card>
            <CardBody className="text-sm text-status-danger">
              Failed to load customers: {error.message}
            </CardBody>
          </Card>
        ) : null}

      <ModuleListPanel>
        <ModuleListPanelFilters>
        <form
          method="get"
          action="/marketing/customers"
          className="contents"
        >
          <nav
            aria-label="Filter by segment"
            className="mb-3 flex flex-wrap gap-2"
          >
            {TAG_FILTERS.map((chip) => {
              const isActive =
                chip.slug === null
                  ? !query.tags || query.tags.length === 0
                  : activeTag === chip.slug;
              return (
                <Link
                  key={chip.label}
                  href={tagFilterHref(chip.slug)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    isActive
                      ? "border-violet-500 bg-violet-500 text-white shadow-sm"
                      : "border-cream-300 bg-white text-ink-muted hover:border-violet-300 hover:text-violet-800 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400 dark:hover:border-violet-700 dark:hover:text-violet-200",
                  )}
                >
                  {chip.label}
                  <span
                    className={cn(
                      "tabular-nums",
                      isActive
                        ? "text-white/90"
                        : "text-ink-subtle dark:text-cream-500",
                    )}
                  >
                    {formatCount(chip.count)}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-cream-300 bg-cream-50/50 px-3 py-2.5 dark:border-hairline-dark dark:bg-panel-dark/60">
              <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={2} />
              <input
                type="search"
                name="q"
                defaultValue={query.q ?? ""}
                placeholder="Search name or phone…"
                className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {query.tags?.length ? (
                <input
                  type="hidden"
                  name="tags"
                  value={query.tags.join(",")}
                />
              ) : null}
              <select
                name="source"
                defaultValue={query.source ?? ""}
                className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-semibold text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              >
                <option value="">All sources</option>
                <option value="manual">Manual</option>
                <option value="pos">POS</option>
                <option value="booking">Booking</option>
                <option value="lead_conversion">Lead conversion</option>
                <option value="csv_import">CSV import</option>
                <option value="public_booking_page">Public booking</option>
              </select>
              <input type="hidden" name="sort" defaultValue={query.sort} />
              <input type="hidden" name="order" defaultValue={query.order} />
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700"
              >
                Search
              </button>
              <Link
                href="/marketing/customers"
                className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
              >
                Clear
              </Link>
              <a
                href={exportHref}
                rel="nofollow"
                className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2} />
                {hasFilters ? "Export filtered" : "Export all"}
              </a>
            </div>
          </div>
          {filteredLabel ? (
            <p className="mt-3 text-xs font-medium text-violet-700 dark:text-violet-300">
              Showing {filteredLabel}
              {query.tags?.length
                ? ` · tag: ${query.tags.join(", ")}`
                : null}
              {query.q ? ` · “${query.q}”` : null}
            </p>
          ) : null}
        </form>
        </ModuleListPanelFilters>

        <CustomerListSelectable
          rows={rows}
          sort={{
            field: query.sort,
            order: query.order,
            hrefs: {
              name: sortHref("name"),
              total_spend_myr: sortHref("total_spend_myr"),
              last_purchase_at: sortHref("last_purchase_at"),
            },
          }}
        />

        <ModuleListPanelFooter>
          <p>
            Showing {pageStart}–{pageEnd} of {total}
          </p>
          <div className="flex items-center gap-1.5">
            <Pager
              disabled={query.page <= 1}
              href={query.page > 1 ? pageHref(query.page - 1) : undefined}
              icon={<ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.25} />}
              label="Previous"
            />
            <PageBadge label={String(query.page)} active />
            <span className="text-[11px] text-ink-subtle">of {pageCount}</span>
            <Pager
              disabled={query.page >= pageCount}
              href={query.page < pageCount ? pageHref(query.page + 1) : undefined}
              icon={<ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />}
              label="Next"
            />
          </div>
        </ModuleListPanelFooter>
      </ModuleListPanel>

        {(snapshot.dormantCount > 0 || snapshot.atRiskCount > 0) &&
        !query.tags?.length ? (
          <AiBanner
            label="Win-back ready"
            message={`${formatCount(snapshot.dormantCount + snapshot.atRiskCount)} customers could use a nudge. Tap Dormant or At-risk above, then start a broadcast.`}
            cta="New broadcast"
            href="/marketing/broadcasts/new"
          />
        ) : null}
      </div>
    </MarketingSubpageShell>
  );
}

function PageBadge({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-[11px] font-semibold",
        active
          ? "border-brand-500 bg-brand-500 text-white"
          : "border-cream-300 bg-white text-ink-muted dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
      )}
    >
      {label}
    </span>
  );
}

function Pager({
  disabled,
  href,
  icon,
  label,
}: {
  disabled: boolean;
  href?: string;
  icon: React.ReactNode;
  label: string;
}) {
  const base =
    "inline-flex h-7 w-7 items-center justify-center rounded-md border border-cream-300 bg-white text-ink-muted dark:border-hairline-dark dark:bg-panel-dark";
  if (disabled || !href) {
    return (
      <span aria-label={label} className={`${base} opacity-40`}>
        {icon}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={`${base} hover:text-ink`}>
      {icon}
    </Link>
  );
}
