import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  planIncludesAgentSlug,
  tierIncludedAgentSlugs,
} from "@/lib/settings/tier-agents";
import type { TierKey } from "@/lib/settings/plans";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasActiveAddonWithClient } from "@/lib/marketplace/entitlements";

export function planIncludesAgent(
  tier: TierKey | string,
  addonSlug: string,
): boolean {
  return planIncludesAgentSlug(tier, addonSlug);
}

/** Plan-included agent slugs for tier (no marketplace row required). */
export function planIncludedAgentSlugsForTier(
  tier: TierKey | string,
): readonly string[] {
  return tierIncludedAgentSlugs(tier);
}

/**
 * Agent entitlement: included in plan OR legacy active marketplace addon.
 */
export async function hasAgentEntitlementWithClient(
  supabase: SupabaseClient,
  businessId: string,
  tier: TierKey | string,
  addonSlug: string,
): Promise<boolean> {
  if (planIncludesAgent(tier, addonSlug)) {
    return true;
  }
  return hasActiveAddonWithClient(supabase, businessId, addonSlug);
}

export async function hasAgentEntitlement(
  businessId: string,
  tier: TierKey | string,
  addonSlug: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  return hasAgentEntitlementWithClient(
    supabase,
    businessId,
    tier,
    addonSlug,
  );
}

export async function loadEntitledAgentSlugs(
  businessId: string,
  tier: TierKey | string,
  client?: SupabaseClient,
): Promise<Set<string>> {
  const supabase = client ?? (await createSupabaseServerClient());
  const planSlugs = new Set(planIncludedAgentSlugsForTier(tier));

  const { data, error } = await supabase
    .from("business_addons")
    .select("marketplace_addons!inner(slug)")
    .eq("business_id", businessId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const addon = row.marketplace_addons as unknown as { slug: string };
    planSlugs.add(addon.slug);
  }

  return planSlugs;
}
