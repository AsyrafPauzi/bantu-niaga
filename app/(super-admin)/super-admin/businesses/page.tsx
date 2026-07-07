import Link from "next/link";
import { Download, Plus, Search } from "lucide-react";
import { HealthBandPill } from "@/components/super-admin/HealthBandPill";
import {
  loadBusinessesPage,
  loadBusinessesSummary,
} from "@/lib/super-admin/load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  StatusPill,
  formatMyr,
} from "@/components/super-admin/primitives";
import { ListPagination } from "@/components/ui/list-pagination";
import { parsePagination } from "@/lib/pagination";
import { tierBy, type TierKey } from "@/lib/settings/plans";

export const dynamic = "force-dynamic";

function tierChip(tier: TierKey): React.ReactNode {
  const label = tierBy(tier)?.label ?? tier;
  const colors =
    tier === "enterprise"
      ? "bg-accent-100 text-accent-700"
      : tier === "sme"
        ? "bg-brand-100 text-brand-700"
        : tier === "micro"
          ? "bg-brand-50 text-brand-500"
          : "bg-status-warning/15 text-status-warning";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${colors}`}
    >
      {label}
    </span>
  );
}

function statusToPill(status: string) {
  switch (status) {
    case "active":
      return <StatusPill tone="success" label="Active" />;
    case "past_due":
      return <StatusPill tone="warning" label="Past due" />;
    case "cancelled":
      return <StatusPill tone="danger" label="Cancelled" />;
    case "trial":
      return <StatusPill tone="info" label="Trial" />;
    default:
      return <StatusPill tone="muted" label={status} />;
  }
}

function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z ]/g, "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default async function SuperAdminBusinesses({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pagination = parsePagination(params, { defaultPageSize: 25 });
  const [summary, { rows: businesses, total }] = await Promise.all([
    loadBusinessesSummary(),
    loadBusinessesPage({ from: pagination.from, to: pagination.to }),
  ]);

  return (
    <>
      <PageTopbar
        title="Businesses (tenants)"
        subtitle={`${summary.paying} paying · ${summary.trial} trial · ${summary.cancelled} cancelled`}
        right={
          <>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-muted">
              <Plus className="h-3.5 w-3.5" />
              Create tenant
            </button>
          </>
        }
      />

      <PageBody>
        <div className="flex gap-4 flex-wrap">
          <KpiCard
            label="Total tenants"
            value={summary.total}
            delta="Live count"
          />
          <KpiCard
            label="Monthly recurring"
            value={formatMyr(summary.mrrMyr)}
            delta="From paying tenants"
          />
          <KpiCard
            label="Avg revenue / tenant"
            value={formatMyr(summary.arpuMyr)}
            delta="ARPU"
          />
          <KpiCard
            label="Cancellations"
            value={summary.cancelled}
            delta="lifetime"
            trend={summary.cancelled > 0 ? "down" : "flat"}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[320px] items-center gap-2 rounded-lg border border-cream-300 bg-white px-3 py-2">
            <Search className="h-3.5 w-3.5 text-ink-subtle" />
            <input
              type="search"
              placeholder="Search by business name or owner email…"
              className="w-full bg-transparent text-sm placeholder:text-ink-subtle focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-cream-300 bg-white shadow-card">
          <div className="grid grid-cols-[280px_90px_100px_80px_110px_120px_100px_120px] gap-3 border-b border-cream-300 bg-cream-100 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            <span>Business</span>
            <span>Health</span>
            <span>State</span>
            <span>Plan</span>
            <span>Users</span>
            <span>Credits</span>
            <span>Status</span>
            <span>Joined</span>
          </div>
          <ul>
            {businesses.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-ink-muted">
                No tenants yet. New sign-ups will appear here in real time.
              </li>
            )}
            {businesses.map((b) => (
              <li
                key={b.id}
                className="grid grid-cols-[280px_90px_100px_80px_110px_120px_100px_120px] items-center gap-3 border-b border-cream-300 px-5 py-3 last:border-b-0 hover:bg-cream-100/50"
              >
                <Link
                  href={`/super-admin/businesses/${b.id}`}
                  className="flex items-center gap-2.5 min-w-0"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-100 text-xs font-bold text-brand-700">
                    {initials(b.name)}
                  </div>
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-sm font-semibold text-ink hover:text-brand-700">
                      {b.name}
                    </p>
                    <p className="truncate text-[11px] text-ink-muted">
                      {b.idcompany}.bantuniaga.app
                    </p>
                  </div>
                </Link>
                <HealthBandPill band={b.health_band} score={b.health_score} />
                <span className="truncate text-sm text-ink">
                  {b.state_code ?? "—"}
                </span>
                {tierChip(b.tier)}
                <span className="text-sm font-semibold text-ink">
                  {b.user_count ?? 0}
                </span>
                <span className="text-sm font-semibold text-ink">
                  {b.credit_balance}
                </span>
                {statusToPill(b.subscription_status)}
                <span className="text-xs text-ink-muted">
                  {new Date(b.created_at).toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
          <ListPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
            basePath="/super-admin/businesses"
          />
        </div>
      </PageBody>
    </>
  );
}
