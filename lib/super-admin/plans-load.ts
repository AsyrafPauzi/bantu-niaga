import "server-only";

import {
  PILLARS,
  TIER_PILLARS,
  type Pillar,
} from "@/lib/auth/entitlements";
import { TIERS, tierBy, type TierKey } from "@/lib/settings/plans";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface PlansTierRow {
  key: TierKey;
  label: string;
  priceMyr: number | null;
  tenantCount: number;
  activeCount: number;
  mrrMyr: number;
  modules: readonly Pillar[];
  seatsQuota: number;
  customersQuota: number;
}

export interface PlansSummary {
  totalTenants: number;
  payingTenants: number;
  planMrr: number;
  tiers: PlansTierRow[];
}

export async function loadPlansSummary(): Promise<PlansSummary> {
  const svc = createServiceRoleClient();
  const { data, error } = await svc
    .from("businesses")
    .select("tier, subscription_status");
  if (error) throw error;

  const counts = new Map<TierKey, number>();
  const activeCounts = new Map<TierKey, number>();
  for (const tier of TIERS) {
    counts.set(tier.key, 0);
    activeCounts.set(tier.key, 0);
  }

  for (const row of data ?? []) {
    const tier = row.tier as TierKey;
    if (!counts.has(tier)) continue;
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
    if (row.subscription_status !== "cancelled") {
      activeCounts.set(tier, (activeCounts.get(tier) ?? 0) + 1);
    }
  }

  let payingTenants = 0;
  let planMrr = 0;
  const tiers: PlansTierRow[] = TIERS.map((plan) => {
    const tenantCount = counts.get(plan.key) ?? 0;
    const activeCount = activeCounts.get(plan.key) ?? 0;
    const price = plan.priceMyr ?? 0;
    const mrrMyr = activeCount * price;
    if (plan.key !== "starter" && plan.priceMyr) {
      payingTenants += activeCount;
      planMrr += activeCount * plan.priceMyr;
    }
    return {
      key: plan.key,
      label: plan.label,
      priceMyr: plan.priceMyr,
      tenantCount,
      activeCount,
      mrrMyr,
      modules: TIER_PILLARS[plan.key],
      seatsQuota: plan.quotas.seats,
      customersQuota: plan.quotas.customers,
    };
  });

  return {
    totalTenants: (data ?? []).length,
    payingTenants,
    planMrr,
    tiers,
  };
}

export function formatQuota(value: number): string {
  if (!Number.isFinite(value)) return "Unlimited";
  if (value === 0) return "—";
  return value.toLocaleString("en-MY");
}

export function formatPlanPrice(priceMyr: number | null): string {
  if (priceMyr == null) return "Custom";
  if (priceMyr === 0) return "RM 0";
  return `RM ${priceMyr}`;
}

export function tierLabel(key: TierKey): string {
  return tierBy(key)?.label ?? key;
}
