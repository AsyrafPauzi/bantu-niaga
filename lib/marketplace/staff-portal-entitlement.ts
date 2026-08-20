import { hasPillar } from "@/lib/auth/entitlements";
import type { TierKey } from "@/lib/settings/plans";

/** Staff self-service is included whenever the HR pillar is unlocked (Solo+). */
export function staffPortalIncludedForTier(tier: TierKey): boolean {
  return hasPillar(tier, "hr");
}
