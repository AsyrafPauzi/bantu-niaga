/**
 * Bantu Niaga — module entitlements (pricing-plan v2026-08).
 *
 *   - Free (starter):     Finance lite only.
 *   - Basic:              Admin + Sales + Finance.
 *   - Solo+ (micro/sme/enterprise): All six pillars.
 */

import type { TierKey } from "@/lib/settings/plans";
import {
  TIER_ORDER,
  TIER_PILLARS_MAP,
} from "@/lib/settings/tier-agents";

export type Pillar =
  | "admin"
  | "finance"
  | "operations"
  | "sales"
  | "hr"
  | "marketing";

export const PILLARS: readonly Pillar[] = [
  "admin",
  "finance",
  "operations",
  "sales",
  "hr",
  "marketing",
];

export const PILLAR_LABEL: Record<Pillar, string> = {
  admin: "Admin",
  finance: "Finance",
  operations: "Operations",
  sales: "Sales",
  hr: "HR",
  marketing: "Marketing",
};

export const TIER_PILLARS: Record<TierKey, readonly Pillar[]> = TIER_PILLARS_MAP;

/** True when the given tier unlocks the given pillar. */
export function hasPillar(tier: TierKey, pillar: Pillar): boolean {
  return TIER_PILLARS[tier]?.includes(pillar) ?? false;
}

/**
 * Map a request pathname (e.g. `/admin/storage`) to the pillar it lives in.
 * Returns `null` for cross-cutting paths that are always allowed.
 */
export function pillarFromPath(pathname: string): Pillar | null {
  const segment = pathname.split("/")[1] ?? "";
  return (PILLARS as readonly string[]).includes(segment)
    ? (segment as Pillar)
    : null;
}

/** Lowest tier that unlocks `pillar` — used for upgrade banners. */
export function minimumTierFor(pillar: Pillar): TierKey {
  for (const t of TIER_ORDER) {
    if (hasPillar(t, pillar)) return t;
  }
  return "enterprise";
}
