import type { TierKey } from "@/lib/settings/plans";

export const TIER_BUNDLED_CREDITS: Record<TierKey, number> = {
  starter: 0,
  basic: 60,
  micro: 120,
  sme: 180,
  enterprise: 360,
};

export function tierBundledCredits(tier: TierKey | string): number {
  return TIER_BUNDLED_CREDITS[tier as TierKey] ?? 0;
}
