import Link from "next/link";
import { LineChart } from "lucide-react";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  Section,
  ToggleVisual,
  formatInt,
  formatMyr,
} from "@/components/super-admin/primitives";
import {
  PILLARS,
  PILLAR_LABEL,
  TIER_PILLARS,
  type Pillar,
} from "@/lib/auth/entitlements";
import {
  formatPlanPrice,
  formatQuota,
  loadPlansSummary,
  tierLabel,
} from "@/lib/super-admin/plans-load";
import type { TierKey } from "@/lib/settings/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans · Super admin" };

export default async function SuperAdminPlans() {
  const summary = await loadPlansSummary();

  return (
    <>
      <PageTopbar
        title="Plans"
        subtitle="Tier catalog from lib/settings/plans with live tenant counts"
        right={
          <Link
            href="/super-admin/revenue"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100"
          >
            <LineChart className="h-3.5 w-3.5" />
            Revenue
          </Link>
        }
      />

      <PageBody>
        <div className="mb-3 grid grid-cols-4 gap-3">
          <KpiCard
            label="Total tenants"
            value={formatInt(summary.totalTenants)}
            subtle="all tiers"
            trend="flat"
          />
          <KpiCard
            label="Paying"
            value={formatInt(summary.payingTenants)}
            subtle="non-free, active"
            trend="up"
          />
          <KpiCard
            label="Plan MRR"
            value={formatMyr(summary.planMrr)}
            subtle="list price × active tenants"
            trend="flat"
          />
          <KpiCard
            label="Free tier"
            value={formatInt(
              summary.tiers.find((tier) => tier.key === "starter")?.tenantCount ??
                0,
            )}
            subtle="starter tenants"
            trend="flat"
          />
        </div>

        <Section
          className="!p-4 !pb-0"
          title="Plan directory"
          description={`${summary.tiers.length} tiers from the static catalog`}
        >
          <div className="-mx-4 mt-3 overflow-x-auto border-t border-cream-200">
            <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-cream-300 bg-cream-50/80 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-2 font-semibold">Plan</th>
                  <th className="px-3 py-2 font-semibold">List price</th>
                  <th className="px-3 py-2 font-semibold">Tenants</th>
                  <th className="px-3 py-2 font-semibold">Active</th>
                  <th className="px-3 py-2 font-semibold">Plan MRR</th>
                  <th className="px-3 py-2 font-semibold">Modules</th>
                  <th className="px-3 py-2 font-semibold">Seats</th>
                  <th className="px-3 py-2 font-semibold">Customers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {summary.tiers.map((tier) => (
                  <tr
                    key={tier.key}
                    className="align-middle hover:bg-cream-50/60"
                  >
                    <td className="px-4 py-2">
                      <p className="font-medium text-ink">{tier.label}</p>
                      <p className="text-[11px] text-ink-muted">{tier.key}</p>
                    </td>
                    <td className="px-3 py-2 text-[11px] font-medium text-ink-muted">
                      {formatPlanPrice(tier.priceMyr)}
                      {tier.priceMyr != null && tier.priceMyr > 0 ? (
                        <span className="text-ink-subtle"> /mo</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      <Link
                        href={`/super-admin/businesses?tier=${tier.key}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {formatInt(tier.tenantCount)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink-muted">
                      {formatInt(tier.activeCount)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-ink-muted">
                      {formatMyr(tier.mrrMyr)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {tier.modules.map((pillar) => (
                          <span
                            key={pillar}
                            className="inline-flex rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700"
                          >
                            {PILLAR_LABEL[pillar]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-ink-muted">
                      {formatQuota(tier.seatsQuota)}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-ink-muted">
                      {formatQuota(tier.customersQuota)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          className="!p-4"
          title="Module matrix"
          description="Runtime entitlements from lib/auth/entitlements.ts"
        >
          <div className="-mx-4 overflow-x-auto border-t border-cream-200">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-cream-300 bg-cream-50/80 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-2 font-semibold">Plan</th>
                  {PILLARS.map((pillar) => (
                    <th
                      key={pillar}
                      className="px-3 py-2 text-center font-semibold"
                    >
                      {PILLAR_LABEL[pillar]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {(["starter", "micro", "sme", "enterprise"] as TierKey[]).map(
                  (tierKey) => {
                    const unlocked = TIER_PILLARS[tierKey];
                    return (
                      <tr
                        key={tierKey}
                        className="align-middle hover:bg-cream-50/60"
                      >
                        <td className="px-4 py-2 font-medium text-ink">
                          {tierLabel(tierKey)}
                        </td>
                        {PILLARS.map((pillar) => (
                          <td key={pillar} className="px-3 py-2 text-center">
                            <div className="flex justify-center">
                              <ToggleVisual
                                on={unlocked.includes(pillar as Pillar)}
                                ariaLabel={`${tierLabel(tierKey)} unlocks ${pillar}`}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </PageBody>
    </>
  );
}
