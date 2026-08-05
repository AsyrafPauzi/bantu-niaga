import Link from "next/link";
import {
  ArrowRight,
  Building2,
  LineChart,
  ScrollText,
  Sparkles,
  Users,
} from "lucide-react";
import { loadOverview } from "@/lib/super-admin/load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  Section,
  StatusPill,
  formatInt,
  formatMyr,
} from "@/components/super-admin/primitives";

export const dynamic = "force-dynamic";

const QUICK_LINKS = [
  {
    href: "/super-admin/businesses",
    label: "Tenants",
    description: "Accounts, tiers, and routing",
    icon: Building2,
  },
  {
    href: "/super-admin/revenue",
    label: "Revenue",
    description: "MRR, collections, invoices",
    icon: LineChart,
  },
  {
    href: "/super-admin/ai-agents",
    label: "AI agents",
    description: "Usage and scope configuration",
    icon: Sparkles,
  },
  {
    href: "/super-admin/tenant-health",
    label: "Tenant health",
    description: "Risk scoring and signals",
    icon: Users,
  },
  {
    href: "/super-admin/audit",
    label: "Audit log",
    description: "Cross-tenant activity",
    icon: ScrollText,
  },
] as const;

const TIER_BAR: Record<string, string> = {
  starter: "bg-cream-400",
  micro: "bg-brand-300",
  sme: "bg-brand-500",
  enterprise: "bg-accent-500",
};

export default async function SuperAdminOverview() {
  const { kpis, planMix, weeklyGrowth, activity, ops } = await loadOverview();

  const maxBar = Math.max(1, ...weeklyGrowth.map((w) => w.count));
  const growthTotal12w = weeklyGrowth.reduce((s, w) => s + w.count, 0);
  const paidShare =
    kpis.totalTenants > 0
      ? Math.round((kpis.paidTenants / kpis.totalTenants) * 100)
      : 0;
  const activeShare =
    kpis.totalTenants > 0
      ? Math.round((kpis.tenantsActive30d / kpis.totalTenants) * 100)
      : 0;
  const atRiskTotal = ops.tenantsAtRisk + ops.tenantsCritical;

  return (
    <>
      <PageTopbar
        title="Platform overview"
        subtitle="Live operational snapshot from tenant and usage data"
        right={
          <Link
            href="/super-admin/businesses"
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-muted"
          >
            Manage tenants
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <PageBody>
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            label="Tenants"
            value={formatInt(kpis.totalTenants)}
            subtle={`${kpis.paidTenants} paid · ${kpis.trialTenants} trial/starter`}
            delta={
              kpis.newTenantsThisWeek > 0
                ? `+${kpis.newTenantsThisWeek} new this week`
                : "No new sign-ups this week"
            }
            trend={kpis.newTenantsThisWeek > 0 ? "up" : "flat"}
          />
          <KpiCard
            label="Plan MRR"
            value={formatMyr(kpis.mrrMyr)}
            subtle={`${formatMyr(kpis.mrrMyr * 12)} annualized (tier list price)`}
            delta={`${paidShare}% on paid tiers`}
            trend="flat"
          />
          <KpiCard
            label="Tenants active (30d)"
            value={formatInt(kpis.tenantsActive30d)}
            subtle={`${activeShare}% of all tenants · audit activity`}
            delta={`${formatInt(kpis.totalUsers)} platform users`}
            trend={kpis.tenantsActive30d > 0 ? "up" : "flat"}
          />
          <KpiCard
            label="AI usage (7d)"
            value={formatInt(kpis.aiInvocations7d)}
            subtle={`${formatInt(kpis.aiCredits7d)} credits charged`}
            delta={
              kpis.aiInvocations7d > 0
                ? "from ai_usage"
                : "No AI calls this week"
            }
            trend={kpis.aiInvocations7d > 0 ? "up" : "flat"}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Section
            className="xl:col-span-2"
            title="Tenant sign-ups"
            description={`${formatInt(growthTotal12w)} new tenants in the last 12 weeks`}
          >
            {growthTotal12w === 0 ? (
              <p className="py-10 text-center text-sm text-ink-muted">
                No tenant sign-ups in the last 12 weeks.
              </p>
            ) : (
              <div className="flex h-52 items-end gap-2 px-1">
                {weeklyGrowth.map((w, i) => {
                  const isLatest = i === weeklyGrowth.length - 1;
                  return (
                    <div
                      key={`${w.weekLabel}-${i}`}
                      className="flex min-w-0 flex-1 flex-col items-center gap-2"
                    >
                      <span className="text-[10px] font-semibold tabular-nums text-ink-muted">
                        {w.count > 0 ? w.count : ""}
                      </span>
                      <div
                        className={`w-full rounded-t-md ${isLatest ? "bg-brand-600" : "bg-brand-300"}`}
                        style={{
                          height: `${Math.max(6, (w.count / maxBar) * 168)}px`,
                        }}
                      />
                      <span className="text-[10px] font-medium text-ink-muted">
                        {w.weekLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section
            title="Plan distribution"
            description={`${formatInt(kpis.totalTenants)} tenants by subscription tier`}
          >
            {kpis.totalTenants === 0 ? (
              <p className="py-8 text-center text-sm text-ink-muted">
                No tenants yet.
              </p>
            ) : (
              <div className="space-y-4">
                {planMix
                  .filter((p) => p.count > 0)
                  .map((p) => {
                    const share = Math.round(
                      (p.count / kpis.totalTenants) * 100,
                    );
                    return (
                      <div key={p.tier} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-semibold text-ink">
                            {p.label}
                          </span>
                          <span className="shrink-0 text-xs text-ink-muted">
                            <span className="font-bold text-ink">
                              {p.count}
                            </span>{" "}
                            · {share}% · {formatMyr(p.monthlyMyr)}/mo
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-cream-200">
                          <div
                            className={`h-full ${TIER_BAR[p.tier] ?? "bg-brand-400"}`}
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Section
            className="lg:col-span-2"
            title="Recent platform activity"
            description="Latest cross-tenant events from audit_log"
            right={
              <Link
                href="/super-admin/audit"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Full audit log
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {activity.length === 0 ? (
              <p className="py-8 text-sm text-ink-muted">
                No audit events yet. Tenant actions will appear here as they use
                the platform.
              </p>
            ) : (
              <ul className="divide-y divide-cream-200">
                {activity.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-cream-300 bg-cream-50 text-xs font-bold text-brand-700">
                      {row.icon[0]?.toUpperCase() ?? "·"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">
                        {row.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {row.subtitle}
                      </p>
                    </div>
                    <time className="shrink-0 text-[11px] font-medium text-ink-subtle">
                      {row.whenLabel}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="space-y-5">
            <Section title="Operations" description="Live signals that need attention">
              <ul className="space-y-3">
                <li className="flex items-center justify-between gap-3 rounded-lg border border-cream-200 bg-cream-50/80 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-ink">AI (ILMU)</p>
                    <p className="text-[11px] text-ink-muted">
                      Platform LLM via ILMU_API_KEY
                    </p>
                  </div>
                  {ops.ilmuConfigured ? (
                    <StatusPill tone="success" label="Configured" />
                  ) : (
                    <StatusPill tone="warning" label="Missing key" />
                  )}
                </li>
                <li className="flex items-center justify-between gap-3 rounded-lg border border-cream-200 bg-cream-50/80 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Tenant health
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      At risk or critical tenants
                    </p>
                  </div>
                  {atRiskTotal > 0 ? (
                    <StatusPill tone="warning" label={formatInt(atRiskTotal)} />
                  ) : (
                    <StatusPill tone="success" label="None" />
                  )}
                </li>
              </ul>
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href="/super-admin/tenant-health"
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  Open tenant health →
                </Link>
              </div>
            </Section>

            <Section title="Quick navigation">
              <ul className="space-y-1">
                {QUICK_LINKS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-cream-100"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-cream-300 bg-white text-brand-700">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-ink">
                            {item.label}
                          </span>
                          <span className="block text-[11px] text-ink-muted">
                            {item.description}
                          </span>
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Section>
          </div>
        </div>
      </PageBody>
    </>
  );
}
