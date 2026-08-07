/**
 * Tier → agents, credits, and AI policy (pricing-plan v2026-08).
 */
import type { Pillar } from "@/lib/auth/entitlements";
import type { TierKey } from "@/lib/settings/plans";
import {
  ADMIN_ASSISTANT_ADDON_SLUG,
  FINANCE_ASSISTANT_ADDON_SLUG,
  HR_ASSISTANT_ADDON_SLUG,
  MARKETING_ASSISTANT_ADDON_SLUG,
  OPERATIONS_ASSISTANT_ADDON_SLUG,
  SALES_ASSISTANT_ADDON_SLUG,
} from "@/lib/marketplace/agent-addon-slugs";
import {
  TIER_BUNDLED_CREDITS,
  tierBundledCredits,
} from "@/lib/settings/tier-bundled-credits";

export { TIER_BUNDLED_CREDITS, tierBundledCredits };

export const ALL_AGENT_ADDON_SLUGS: readonly string[] = [
  ADMIN_ASSISTANT_ADDON_SLUG,
  FINANCE_ASSISTANT_ADDON_SLUG,
  SALES_ASSISTANT_ADDON_SLUG,
  OPERATIONS_ASSISTANT_ADDON_SLUG,
  HR_ASSISTANT_ADDON_SLUG,
  MARKETING_ASSISTANT_ADDON_SLUG,
];

export const BASIC_AGENT_ADDON_SLUGS: readonly string[] = [
  ADMIN_ASSISTANT_ADDON_SLUG,
  SALES_ASSISTANT_ADDON_SLUG,
  FINANCE_ASSISTANT_ADDON_SLUG,
];

/** Free tier usage caps (pricing-plan §4). */
export const FREE_TIER_INVOICES_PER_MONTH = 25;
export const FREE_TIER_EMAILS_PER_MONTH = 25;
export const FREE_TIER_CUSTOMERS_MAX = 50;

export const TIER_ORDER: readonly TierKey[] = [
  "starter",
  "basic",
  "micro",
  "sme",
  "enterprise",
];

export const TIER_PILLARS_MAP: Record<TierKey, readonly Pillar[]> = {
  starter: ["finance"],
  basic: ["admin", "sales", "finance"],
  micro: ["admin", "finance", "operations", "sales", "hr", "marketing"],
  sme: ["admin", "finance", "operations", "sales", "hr", "marketing"],
  enterprise: ["admin", "finance", "operations", "sales", "hr", "marketing"],
};

export const TIER_AGENT_SLUGS: Record<TierKey, readonly string[]> = {
  starter: [],
  basic: BASIC_AGENT_ADDON_SLUGS,
  micro: ALL_AGENT_ADDON_SLUGS,
  sme: ALL_AGENT_ADDON_SLUGS,
  enterprise: ALL_AGENT_ADDON_SLUGS,
};

export const TIER_ALLOW_DEEP_REASONING: Record<TierKey, boolean> = {
  starter: false,
  basic: false,
  micro: true,
  sme: true,
  enterprise: true,
};

export const TIER_BOARDROOM_ALLOWED: Record<TierKey, boolean> = {
  starter: false,
  basic: false,
  micro: true,
  sme: true,
  enterprise: true,
};

export function isFreeTier(tier: TierKey | string): boolean {
  return tier === "starter";
}

export function isPaidTier(tier: TierKey | string): boolean {
  return tier !== "starter";
}

export function tierIncludedAgentSlugs(tier: TierKey | string): readonly string[] {
  return TIER_AGENT_SLUGS[tier as TierKey] ?? [];
}

export function tierAllowsDeepReasoning(tier: TierKey | string): boolean {
  return TIER_ALLOW_DEEP_REASONING[tier as TierKey] ?? false;
}

export function tierAllowsBoardroom(tier: TierKey | string): boolean {
  return TIER_BOARDROOM_ALLOWED[tier as TierKey] ?? false;
}

export function planIncludesAgentSlug(
  tier: TierKey | string,
  addonSlug: string,
): boolean {
  return tierIncludedAgentSlugs(tier).includes(addonSlug);
}

/** Max single recurring add-on price = 50% of plan MRR (pricing-plan §9). */
export function maxAddonPriceMyrForTier(tier: TierKey | string): number {
  const amounts: Record<TierKey, number> = {
    starter: 0,
    basic: 20,
    micro: 40,
    sme: 85,
    enterprise: 150,
  };
  return amounts[tier as TierKey] ?? 0;
}
