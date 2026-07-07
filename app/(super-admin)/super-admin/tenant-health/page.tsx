import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { HealthBandPill } from "@/components/super-admin/HealthBandPill";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  Section,
  StatusPill,
} from "@/components/super-admin/primitives";
import { ListPagination } from "@/components/ui/list-pagination";
import { paginateArray, parsePagination } from "@/lib/pagination";
import {
  computeTenantHealthScores,
  loadTenantHealth,
} from "@/lib/super-admin/health";
import { tierBy } from "@/lib/settings/plans";

export const dynamic = "force-dynamic";

export default async function SuperAdminTenantHealthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.refresh === "1") {
    await computeTenantHealthScores();
  }

  const health = await loadTenantHealth();
  const tenantPagination = parsePagination(params, {
    defaultPageSize: 25,
    pageKey: "page",
  });
  const { items: tenantsPage, total: tenantsTotal } = paginateArray(
    health.tenants,
    tenantPagination.page,
    tenantPagination.pageSize,
  );
  const atRisk = health.tenants.filter(
    (t) => t.band === "at_risk" || t.band === "critical",
  );

  return (
    <>
      <PageTopbar
        title="Tenant health"
        subtitle="Automated scoring from subscription, activity, credits, and AI reliability"
        right={
          <Link
            href="/super-admin/tenant-health?refresh=1"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recompute now
          </Link>
        }
      />
      <PageBody>
        <div className="flex flex-wrap gap-4">
          <KpiCard
            label="Average score"
            value={health.averageScore}
            delta="across all tenants"
          />
          <KpiCard
            label="Healthy"
            value={health.healthy}
            trend="up"
          />
          <KpiCard
            label="Watch"
            value={health.watch}
            trend="flat"
          />
          <KpiCard
            label="At risk / critical"
            value={health.atRisk + health.critical}
            trend={health.atRisk + health.critical > 0 ? "down" : "flat"}
          />
        </div>

        {atRisk.length > 0 ? (
          <Section
            title="Needs attention"
            description="Tenants scoring below 55 — review before churn."
          >
            <ul className="space-y-2">
              {atRisk.map((t) => (
                <li key={t.businessId}>
                  <Link
                    href={`/super-admin/businesses/${t.businessId}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 px-4 py-3 hover:bg-status-warning/10"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{t.businessName}</p>
                      <p className="text-xs text-ink-muted">
                        {t.idcompany} · {tierBy(t.tier)?.label ?? t.tier}
                      </p>
                    </div>
                    <HealthBandPill band={t.band} score={t.score} />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="All tenants" description="Latest computed snapshot.">
          <div className="overflow-hidden rounded-xl border border-cream-300 bg-white shadow-card">
            <div className="grid grid-cols-[minmax(0,1fr)_100px_120px_100px] gap-3 border-b border-cream-300 bg-cream-100 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              <span>Business</span>
              <span>Plan</span>
              <span>Status</span>
              <span>Health</span>
            </div>
            <ul>
              {health.tenants.length === 0 ? (
                <li className="px-5 py-10 text-center text-sm text-ink-muted">
                  No scores yet.{" "}
                  <Link
                    href="/super-admin/tenant-health?refresh=1"
                    className="font-semibold text-brand-700"
                  >
                    Run first compute
                  </Link>
                </li>
              ) : (
                tenantsPage.map((t) => (
                  <li
                    key={t.businessId}
                    className="grid grid-cols-[minmax(0,1fr)_100px_120px_100px] items-center gap-3 border-b border-cream-300 px-5 py-3 last:border-b-0 hover:bg-cream-50"
                  >
                    <Link
                      href={`/super-admin/businesses/${t.businessId}`}
                      className="min-w-0"
                    >
                      <p className="truncate text-sm font-semibold text-ink">
                        {t.businessName}
                      </p>
                      <p className="truncate text-[11px] text-ink-muted">
                        {Object.entries(t.signals)
                          .slice(0, 3)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </p>
                    </Link>
                    <span className="text-xs font-semibold text-ink">
                      {tierBy(t.tier)?.label ?? t.tier}
                    </span>
                    <StatusPill
                      tone={
                        t.subscriptionStatus === "active"
                          ? "success"
                          : t.subscriptionStatus === "past_due"
                            ? "warning"
                            : "muted"
                      }
                      label={t.subscriptionStatus}
                    />
                    <HealthBandPill band={t.band} score={t.score} />
                  </li>
                ))
              )}
            </ul>
            <ListPagination
              page={tenantPagination.page}
              pageSize={tenantPagination.pageSize}
              total={tenantsTotal}
              basePath="/super-admin/tenant-health"
              searchParams={
                params.refresh === "1" ? { refresh: "1" } : undefined
              }
            />
          </div>
        </Section>
      </PageBody>
    </>
  );
}
