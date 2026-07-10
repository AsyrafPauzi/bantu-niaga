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
  UserPlus,
  Users,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusPill } from "@/components/dashboard/status-pill";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { cn } from "@/lib/utils/cn";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListQuerySchema } from "@/lib/marketing/schemas";
import { formatCount, formatMyr } from "@/lib/marketing/metrics";
import { getKpiSnapshot } from "@/lib/marketing/dashboard-queries";

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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function segmentFromTags(autoTags: string[]): {
  label: string;
  tone: "accent" | "brand" | "success" | "warning" | "neutral";
} {
  if (autoTags.includes("vip")) return { label: "VIP", tone: "accent" };
  if (autoTags.includes("at-risk")) return { label: "At-risk", tone: "warning" };
  if (autoTags.includes("repeat")) return { label: "Repeat", tone: "brand" };
  if (autoTags.includes("new")) return { label: "New", tone: "success" };
  if (autoTags.includes("dormant")) return { label: "Dormant", tone: "neutral" };
  return { label: "—", tone: "neutral" };
}

function fmtRel(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  const days = Math.round(diffSec / 86400);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
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

  const MINI_KPIS = [
    {
      label: "Total",
      value: formatCount(snapshot.totalCustomers),
      helper: `+${formatCount(snapshot.newThisMonth)} MTD`,
      icon: Users,
      tone: "brand" as const,
      href: "/marketing/customers",
    },
    {
      label: "VIP",
      value: formatCount(snapshot.vipCount),
      helper:
        snapshot.totalCustomers > 0
          ? `${Math.round((snapshot.vipCount / snapshot.totalCustomers) * 100)}% of base`
          : "—",
      icon: Star,
      tone: "accent" as const,
      href: "/marketing/customers?tags=vip",
    },
    {
      label: "Repeat",
      value: formatCount(snapshot.repeatCount),
      helper:
        snapshot.totalCustomers > 0
          ? `${Math.round((snapshot.repeatCount / snapshot.totalCustomers) * 100)}% of base`
          : "—",
      icon: Users,
      tone: "brand" as const,
      href: "/marketing/customers?tags=repeat",
    },
    {
      label: "Dormant",
      value: formatCount(snapshot.dormantCount),
      helper: snapshot.dormantCount > 0 ? "win back soon" : "none",
      icon: Users,
      tone: "neutral" as const,
      href: "/marketing/customers?tags=dormant",
    },
    {
      label: "At-risk",
      value: formatCount(snapshot.atRiskCount),
      helper: snapshot.atRiskCount > 0 ? "needs care" : "all clear",
      icon: AlertTriangle,
      tone: "warning" as const,
      href: "/marketing/customers?tags=at-risk",
    },
    {
      label: "New (MTD)",
      value: formatCount(snapshot.newThisMonth),
      helper: `${formatMyr(snapshot.avgAovMyr)} AOV`,
      icon: UserPlus,
      tone: "success" as const,
      href: "/marketing/customers?tags=new",
    },
  ];

  const KPI_TONE: Record<string, { wrap: string; icon: string }> = {
    brand: {
      wrap: "bg-brand-50 dark:bg-brand-900/30",
      icon: "text-brand-700 dark:text-brand-200",
    },
    accent: {
      wrap: "bg-accent-50 dark:bg-accent-700/20",
      icon: "text-accent-700 dark:text-accent-200",
    },
    warning: {
      wrap: "bg-status-warning/15",
      icon: "text-[#8C5C0A] dark:text-[#F5C97A]",
    },
    success: {
      wrap: "bg-status-success/10",
      icon: "text-status-success",
    },
    neutral: {
      wrap: "bg-cream-200 dark:bg-hairline-dark",
      icon: "text-ink-muted dark:text-cream-400",
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketing"
        title="Customers"
        description="Card-index CRM with auto-segmentation, tags, and spend signals."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/marketing/customers/import"
              className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
            >
              <Upload className="h-4 w-4" strokeWidth={2} />
              Import CSV
            </Link>
            <Link
              href="/marketing/customers/new"
              className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} />
              New customer
            </Link>
          </div>
        }
      />

      <section
        aria-label="Customer counts"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4"
      >
        {MINI_KPIS.map((k) => {
          const tone = KPI_TONE[k.tone];
          return (
            <Link key={k.label} href={k.href} className="block transition-opacity hover:opacity-90">
              <Card>
                <CardBody className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                      {k.label}
                    </p>
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-md ${tone.wrap} ${tone.icon}`}
                    >
                      <k.icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-ink dark:text-cream-100">
                    {k.value}
                  </p>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    {k.helper}
                  </p>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </section>

      {snapshot.dormantCount > 0 || snapshot.atRiskCount > 0 ? (
        <AiBanner
          label="Win-back ready"
          message={`${formatCount(snapshot.dormantCount + snapshot.atRiskCount)} customers need attention. Filter Dormant or At-risk, then send a broadcast — auto win-back packs are a Marketplace add-on.`}
          cta="Open broadcasts"
          href="/marketing/broadcasts/new"
        />
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

      <Card>
        <form
          method="get"
          action="/marketing/customers"
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-cream-300 bg-white px-3 py-2 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <Search className="h-4 w-4 text-ink-muted" strokeWidth={2} />
            <input
              type="search"
              name="q"
              defaultValue={query.q ?? ""}
              placeholder="Search by name or phone…"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100 dark:placeholder:text-cream-400"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              name="source"
              defaultValue={query.source ?? ""}
              className="rounded-md border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
            >
              <option value="">All sources</option>
              <option value="manual">Manual</option>
              <option value="pos">POS</option>
              <option value="booking">Booking</option>
              <option value="lead_conversion">Lead conversion</option>
              <option value="csv_import">CSV import</option>
              <option value="public_booking_page">Public booking</option>
            </select>
            <input
              type="hidden"
              name="sort"
              defaultValue={query.sort}
            />
            <input
              type="hidden"
              name="order"
              defaultValue={query.order}
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Apply
            </button>
            <Link
              href="/marketing/customers"
              className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
            >
              Reset
            </Link>
            <a
              href="/api/marketing/customers/csv-export"
              rel="nofollow"
              className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              Export
            </a>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="hidden lg:block">
          <table className="min-w-full text-sm">
            <thead className="bg-cream-100/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
              <tr>
                <th className="px-5 py-3 text-left">Customer</th>
                <th className="px-3 py-3 text-left">Segment</th>
                <th className="px-3 py-3 text-left">Tags</th>
                <th className="px-3 py-3 text-left">Phone</th>
                <th className="px-3 py-3 text-right">Spend</th>
                <th className="px-3 py-3 text-right">Orders</th>
                <th className="px-5 py-3 text-right">Last contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-ink-muted dark:text-cream-400">
                    No customers match the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const seg = segmentFromTags(row.auto_tags);
                  const tags = [
                    ...row.manual_tags.slice(0, 2),
                    ...row.auto_tags.filter((t) => !["vip", "repeat", "new", "dormant", "at-risk"].includes(t)).slice(0, 1),
                  ].slice(0, 2);
                  return (
                    <tr
                      key={row.id}
                      className="bg-panel-light hover:bg-cream-100/60 dark:bg-panel-dark dark:hover:bg-hairline-dark/40"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/marketing/customers/${row.id}`}
                          className="flex items-center gap-3"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                            {initialsOf(row.name)}
                          </span>
                          <span className="font-semibold text-ink hover:text-brand-700 dark:text-cream-100">
                            {row.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill tone={seg.tone}>{seg.label}</StatusPill>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {tags.length === 0 ? (
                            <span className="text-xs text-ink-subtle">—</span>
                          ) : (
                            tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-medium text-ink-muted dark:bg-hairline-dark dark:text-cream-400"
                              >
                                {tag}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-ink-muted dark:text-cream-400">
                        {row.phone_e164 ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink dark:text-cream-100">
                        {formatMyr(row.total_spend_myr)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-muted dark:text-cream-400">
                        {row.order_count}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-ink-muted dark:text-cream-400">
                        {fmtRel(row.last_purchase_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile / compact list */}
        <div className="divide-y divide-cream-200 lg:hidden dark:divide-hairline-dark">
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-muted dark:text-cream-400">
              No customers match the current filters.
            </p>
          ) : (
            rows.map((row) => {
              const seg = segmentFromTags(row.auto_tags);
              return (
                <Link
                  key={row.id}
                  href={`/marketing/customers/${row.id}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                    {initialsOf(row.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                      {row.name}
                    </p>
                    <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                      {row.phone_e164 ?? "no phone"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-ink dark:text-cream-100">
                      {formatMyr(row.total_spend_myr)}
                    </p>
                    <StatusPill tone={seg.tone}>{seg.label}</StatusPill>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-cream-200 bg-cream-100/40 px-5 py-3 text-xs text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400">
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
        </div>
      </Card>
    </div>
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
