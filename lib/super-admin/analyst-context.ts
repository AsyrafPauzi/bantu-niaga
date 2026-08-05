import "server-only";

import { loadRevenueDashboard } from "@/lib/super-admin/revenue";
import { loadOverview } from "@/lib/super-admin/load";
import { loadTenantHealth } from "@/lib/super-admin/health";

export interface PlatformAnalystSnapshot {
  generatedAt: string;
  revenue: {
    mrrTotalMyr: number;
    mrrSubscriptionMyr: number;
    mrrAddonMyr: number;
    mrrGrowthPct: number | null;
    netNewMrrMyr: number;
    arpuMyr: number;
    payingTenants: number;
    collectedLast30dMyr: number;
    collectedLast90dMyr: number;
    pendingInvoicesMyr: number;
    pendingInvoiceCount: number;
    aiCost30dMyr: number;
    grossMarginPct: number | null;
    monthlyCollected: Array<{
      month: string;
      subscriptionMyr: number;
      addonMyr: number;
      totalMyr: number;
    }>;
    topAddons: Array<{ name: string; mrrMyr: number; tenants: number }>;
    topTenants: Array<{ name: string; collectedMyr: number }>;
    byKind: Array<{ label: string; amountMyr: number; count: number }>;
    planMix: Array<{ label: string; count: number; mrrMyr: number }>;
  };
  platform: {
    totalTenants: number;
    paidTenants: number;
    trialTenants: number;
    tenantsActive30d: number;
    aiInvocations7d: number;
    tenantsAtRisk: number;
    tenantsCritical: number;
    averageHealthScore: number;
  };
}

export async function buildPlatformAnalystSnapshot(): Promise<PlatformAnalystSnapshot> {
  const [revenue, overview, health] = await Promise.all([
    loadRevenueDashboard(),
    loadOverview(),
    loadTenantHealth(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    revenue: {
      mrrTotalMyr: revenue.mrrTotalMyr,
      mrrSubscriptionMyr: revenue.mrrSubscriptionMyr,
      mrrAddonMyr: revenue.mrrAddonMyr,
      mrrGrowthPct: revenue.mrrGrowthPct,
      netNewMrrMyr: revenue.netNewMrrMyr,
      arpuMyr: revenue.arpuMyr,
      payingTenants: revenue.payingTenantCount,
      collectedLast30dMyr: revenue.collectedLast30dMyr,
      collectedLast90dMyr: revenue.collectedLast90dMyr,
      pendingInvoicesMyr: revenue.pendingInvoicesMyr,
      pendingInvoiceCount: revenue.pendingInvoiceCount,
      aiCost30dMyr: revenue.aiCost30dMyr,
      grossMarginPct: revenue.grossMarginPct,
      monthlyCollected: revenue.monthly.map((m) => ({
        month: m.label,
        subscriptionMyr: m.subscriptionMyr,
        addonMyr: m.addonMyr,
        totalMyr: m.totalMyr,
      })),
      topAddons: revenue.addonMrrBySlug.slice(0, 8).map((a) => ({
        name: a.name,
        mrrMyr: a.mrrMyr,
        tenants: a.tenantCount,
      })),
      topTenants: revenue.topTenants.slice(0, 10).map((t) => ({
        name: t.name,
        collectedMyr: t.amountMyr,
      })),
      byKind: revenue.byKind.map((k) => ({
        label: k.label,
        amountMyr: k.amountMyr,
        count: k.count,
      })),
      planMix: revenue.planRevenue.map((p) => ({
        label: p.label,
        count: p.count,
        mrrMyr: p.mrrMyr,
      })),
    },
    platform: {
      totalTenants: overview.kpis.totalTenants,
      paidTenants: overview.kpis.paidTenants,
      trialTenants: overview.kpis.trialTenants,
      tenantsActive30d: overview.kpis.tenantsActive30d,
      aiInvocations7d: overview.kpis.aiInvocations7d,
      tenantsAtRisk: health.atRisk,
      tenantsCritical: health.critical,
      averageHealthScore: health.averageScore,
    },
  };
}

export function snapshotToPromptJson(snapshot: PlatformAnalystSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
