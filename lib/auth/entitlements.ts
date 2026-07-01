/**
 * Bantu Niaga — module entitlements.
 *
 * One place that answers: "Which pillar modules does this tier unlock?"
 *
 *   - Free (starter):     Finance only.
 *   - Starter (micro):    Finance + Admin + Operations.
 *   - Growth (sme):       Finance + Admin + Operations + Sales + HR.
 *   - Pro (enterprise):   Finance + Admin + Operations + Sales + HR + Marketing.
 *
 * Cross-cutting surfaces (Home, AI Boardroom, Marketplace, Settings, the
 * mobile "More" page) are always available regardless of tier.
 *
 * This module is the single source of truth for:
 *   - sidebar visibility (desktop + mobile),
 *   - server-side route guards (`requirePillar`),
 *   - the Home pillar tiles' locked state,
 *   - the Subscription "compare plans" feature list.
 */

import type { TierKey } from "@/lib/settings/plans";

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

/**
 * The cumulative pillar bundle for each tier. Subsequent tiers strictly
 * include the previous tier's pillars (an upgrade never removes a module).
 */
export const TIER_PILLARS: Record<TierKey, readonly Pillar[]> = {
  starter: ["finance"],
  micro: ["finance", "admin", "operations"],
  sme: ["finance", "admin", "operations", "sales", "hr"],
  enterprise: ["finance", "admin", "operations", "sales", "hr", "marketing"],
};

/** True when the given tier unlocks the given pillar. */
export function hasPillar(tier: TierKey, pillar: Pillar): boolean {
  return TIER_PILLARS[tier].includes(pillar);
}

/**
 * Map a request pathname (e.g. `/admin/storage`) to the pillar it lives in.
 * Returns `null` for cross-cutting paths (Home / Boardroom / Marketplace /
 * Settings / More) that are always allowed.
 */
export function pillarFromPath(pathname: string): Pillar | null {
  const segment = pathname.split("/")[1] ?? "";
  return (PILLARS as readonly string[]).includes(segment)
    ? (segment as Pillar)
    : null;
}

/**
 * Return the lowest tier that unlocks `pillar`. Used by the upgrade banner
 * and locked tiles ("Upgrade to Starter to unlock Admin").
 */
export function minimumTierFor(pillar: Pillar): TierKey {
  const order: TierKey[] = ["starter", "micro", "sme", "enterprise"];
  for (const t of order) {
    if (hasPillar(t, pillar)) return t;
  }
  return "enterprise";
}
