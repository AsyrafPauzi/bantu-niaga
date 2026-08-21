import { PILLAR_LABEL, type AddonPillar, type CatalogEntry } from "@/lib/marketplace/types";
import { tierBy, type TierKey } from "@/lib/settings/plans";
import {
  planIncludesAgentSlug,
  TIER_PILLARS_MAP,
} from "@/lib/settings/tier-agents";
import {
  ADDON_MARKET_CATEGORY_LABEL,
  isAddonMarketCategory,
} from "@/lib/marketplace/addon-market-categories";
import type { AddonMarketCategory } from "@/lib/marketplace/addon-market-categories";

export type FilterKey =
  | "all"
  | "active"
  | "bundles"
  | AddonPillar
  | AddonMarketCategory;

type ModuleAddonPillar = Exclude<AddonPillar, "ai" | "cross">;

export const TIER_LABEL: Record<TierKey, string> = {
  starter: "Free",
  basic: "Basic",
  micro: "Solo",
  sme: "Micro",
  enterprise: "Small",
};

const MODULE_ADDON_PILLARS: readonly ModuleAddonPillar[] = [
  "admin",
  "finance",
  "operations",
  "sales",
  "marketing",
  "hr",
];

export function isTierKey(value: string): value is TierKey {
  return (
    value === "starter" ||
    value === "basic" ||
    value === "micro" ||
    value === "sme" ||
    value === "enterprise"
  );
}

export function isModuleAddonPillar(
  value: AddonPillar,
): value is ModuleAddonPillar {
  return (MODULE_ADDON_PILLARS as readonly string[]).includes(value);
}

export function addonEligibility(addon: CatalogEntry["addon"], tier: string) {
  if (!isTierKey(tier)) return { canActivate: false, reason: "Unknown plan." };
  if (planIncludesAgentSlug(tier, addon.slug)) {
    return {
      canActivate: false,
      reason: "Included in your plan — configure in Settings → AI agents.",
    };
  }
  if (tier === "starter") {
    return {
      canActivate: false,
      reason: "Free plan cannot activate add-ons. Upgrade to Basic or higher.",
    };
  }
  const tierPillars = TIER_PILLARS_MAP[tier];
  if (
    isModuleAddonPillar(addon.pillar) &&
    !tierPillars.includes(addon.pillar)
  ) {
    const minTier = Object.entries(TIER_PILLARS_MAP).find(([, pillars]) =>
      pillars.includes(addon.pillar as ModuleAddonPillar),
    )?.[0];
    const label = minTier ? tierBy(minTier as TierKey)?.label : "a higher plan";
    return {
      canActivate: false,
      reason: `${PILLAR_LABEL[addon.pillar]} add-ons require ${label} or higher.`,
    };
  }
  return { canActivate: true, reason: null };
}

export function tierLabel(t: string): string {
  return isTierKey(t)
    ? TIER_LABEL[t]
    : t.slice(0, 1).toUpperCase() + t.slice(1);
}

export function labelFor(key: FilterKey): string {
  if (key === "all" || key === "active")
    return key === "all" ? "All" : "Active";
  if (key === "bundles") return "Bundles";
  if (isAddonMarketCategory(key)) return ADDON_MARKET_CATEGORY_LABEL[key];
  if (key === "ai") return "AI extras";
  return PILLAR_LABEL[key];
}
