import Link from "next/link";
import {
  KpiCard,
  Section,
  StatusPill,
  formatInt,
  formatMyr,
} from "@/components/super-admin/primitives";
import type { IlmuUsageDashboard } from "@/lib/super-admin/ilmu-usage";
import { ListPagination } from "@/components/ui/list-pagination";
import { paginateArray } from "@/lib/pagination";

function keySourceLabel(dashboard: IlmuUsageDashboard): {
  tone: "success" | "warning" | "danger" | "info";
  label: string;
  detail: string;
} {
  if (dashboard.keySource === "integration") {
    return {
      tone: dashboard.integrationEnabled ? "success" : "warning",
      label: "Super-admin integration",
      detail: dashboard.integrationEnabled
        ? "Encrypted key in platform_integrations is active."
        : "Key saved but integration is disabled — env fallback may still apply.",
    };
  }
  if (dashboard.keySource === "env") {
    return {
      tone: "success",
      label: "Environment variable",
      detail:
        "ILMU_API_KEY is set on the server. You do not need to paste the key again in this form unless you want DB-managed rotation.",
    };
  }
  return {
    tone: "danger",
    label: "Not configured",
    detail:
      "Set ILMU_API_KEY in Vercel env or save a key below to enable agents.",
  };
}

export function IlmuUsageMonitor({
  dashboard,
  tenantPage = 1,
  tenantPageSize = 10,
  dailyPage = 1,
  dailyPageSize = 14,
  basePath = "/super-admin/integrations/ilmu",
  paginationParams = {},
}: {
  dashboard: IlmuUsageDashboard;
  tenantPage?: number;
  tenantPageSize?: number;
  dailyPage?: number;
  dailyPageSize?: number;
  basePath?: string;
  paginationParams?: Record<string, string | undefined>;
}) {
  const source = keySourceLabel(dashboard);
  const { items: tenantsPage, total: tenantsTotal } = paginateArray(
    dashboard.topTenants,
    tenantPage,
    tenantPageSize,
  );
  const { items: dailyPageRows, total: dailyTotal } = paginateArray(
    dashboard.daily,
    dailyPage,
    dailyPageSize,
  );
  const maxDaily = Math.max(...dailyPageRows.map((d) => d.invocations), 1);

  return (
    <div className="space-y-5">
      <Section
        title="Platform usage monitor"
        description="Live ILMU consumption across all tenants. Spend reflects tenant credit usage (200 credits = RM 20 retail); compare with your ILMU Console for provider billing."
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusPill tone={source.tone} label={source.label} />
          <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[10px] font-bold text-ink-subtle">
            Model: {dashboard.defaultModel}
          </span>
          {dashboard.envKeyConfigured ? (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
              ILMU_API_KEY in env
            </span>
          ) : null}
          {dashboard.integrationKeyStored ? (
            <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-bold text-accent-700">
              Key saved in DB
            </span>
          ) : null}
        </div>
        <p className="text-xs text-ink-muted">{source.detail}</p>

        <div className="mt-5 flex flex-wrap gap-4">
          <KpiCard
            label="Invocations today"
            value={formatInt(dashboard.invocationsToday)}
            delta={`${formatInt(dashboard.creditsToday)} credits`}
          />
          <KpiCard
            label="Spend today"
            value={formatMyr(dashboard.spendMyrToday)}
            subtle="tenant credit value"
          />
          <KpiCard
            label="Invocations / 7d"
            value={formatInt(dashboard.invocations7d)}
            delta={`${formatInt(dashboard.credits7d)} credits`}
            trend="up"
          />
          <KpiCard
            label="Spend / 7d"
            value={formatMyr(dashboard.spendMyr7d)}
          />
          <KpiCard
            label="Spend / 30d"
            value={formatMyr(dashboard.spendMyr30d)}
            delta={`${formatInt(dashboard.invocations30d)} calls`}
          />
          <KpiCard
            label="Failure rate / 30d"
            value={`${dashboard.failureRate30dPct}%`}
            trend={dashboard.failureRate30dPct > 5 ? "down" : "flat"}
            subtle={
              dashboard.tokensIn30d > 0
                ? `${formatInt(dashboard.tokensIn30d)} in · ${formatInt(dashboard.tokensOut30d)} out tokens`
                : "token metering not wired yet"
            }
          />
        </div>
      </Section>

      <Section
        title="Daily activity"
        description="Platform-wide AI invocations recorded in ai_usage."
      >
        <div className="space-y-2">
          {dailyPageRows.map((row) => (
            <div key={row.day} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-xs font-semibold text-ink-muted">
                {row.label}
              </span>
              <div className="h-7 flex-1 overflow-hidden rounded-md bg-cream-200">
                <div
                  className="h-full rounded-md bg-brand-500"
                  style={{
                    width: `${Math.max(4, (row.invocations / maxDaily) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs font-semibold text-ink">
                {formatInt(row.invocations)}
              </span>
              <span className="w-20 shrink-0 text-right text-xs text-ink-muted">
                {formatMyr(row.spendMyr)}
              </span>
            </div>
          ))}
        </div>
        <ListPagination
          page={dailyPage}
          pageSize={dailyPageSize}
          total={dailyTotal}
          basePath={basePath}
          pageKey="dailyPage"
          searchParams={paginationParams}
          className="mt-2 rounded-lg border border-cream-300 bg-white"
        />
      </Section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="By agent (30d)">
          {dashboard.byAgent.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No AI usage yet. Usage appears after tenants chat with Hana or
              other agents.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-cream-300 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                    <th className="py-2 pr-3">Agent</th>
                    <th className="py-2 pr-3 text-right">Calls</th>
                    <th className="py-2 pr-3 text-right">Credits</th>
                    <th className="py-2 text-right">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.byAgent.map((row) => (
                    <tr
                      key={row.agentSlug}
                      className="border-b border-cream-200 last:border-0"
                    >
                      <td className="py-2.5 pr-3 font-medium text-ink">
                        {row.label}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-ink-muted">
                        {formatInt(row.invocations)}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-ink-muted">
                        {formatInt(row.credits)}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-ink">
                        {formatMyr(row.spendMyr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Top tenants (30d)">
          {tenantsTotal === 0 ? (
            <p className="text-sm text-ink-muted">No tenant usage yet.</p>
          ) : (
            <>
              <div className="space-y-2">
                {tenantsPage.map((row) => (
                <div
                  key={row.businessId}
                  className="flex items-center justify-between rounded-lg border border-cream-200 bg-cream-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {row.name}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {formatInt(row.invocations)} calls ·{" "}
                      {formatInt(row.credits)} credits
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-ink">
                      {formatMyr(row.spendMyr)}
                    </p>
                    <Link
                      href={`/super-admin/businesses/${row.businessId}`}
                      className="text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                    >
                      View tenant →
                    </Link>
                  </div>
                </div>
                ))}
              </div>
              <ListPagination
                page={tenantPage}
                pageSize={tenantPageSize}
                total={tenantsTotal}
                basePath={basePath}
                pageKey="tenantPage"
                searchParams={paginationParams}
                className="mt-2 rounded-lg border border-cream-300 bg-white"
              />
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
