import {
  BUSINESS_BUNDLES,
  computeBundlePricing,
  type BundlePricingSummary,
  type BusinessBundle,
} from "@/lib/onboarding/business-bundles";
import type { CatalogEntry } from "@/lib/marketplace/types";
import { tierBy, type TierKey } from "@/lib/settings/plans";

export interface MarketplaceBundleCard {
  bundle: BusinessBundle;
  pricing: BundlePricingSummary;
  recommendedTierLabel: string;
  matchesCurrentTier: boolean;
  tierMeetsRecommendation: boolean;
}

function catalogMap(entries: CatalogEntry[]) {
  return new Map(
    entries.map((entry) => [
      entry.addon.slug,
      {
        name: entry.addon.name,
        price_cents: entry.addon.price_cents,
        cadence: entry.addon.cadence,
        included_in_tier: entry.addon.included_in_tier,
        is_coming_soon: entry.addon.is_coming_soon,
      },
    ]),
  );
}

function tierRank(tier: TierKey): number {
  const order: TierKey[] = ["starter", "micro", "sme", "enterprise"];
  return order.indexOf(tier);
}

export function buildMarketplaceBundles(opts: {
  catalog: CatalogEntry[];
  currentTier: TierKey;
  activeSlugs: Set<string>;
}): MarketplaceBundleCard[] {
  const catalogBySlug = catalogMap(opts.catalog);

  return BUSINESS_BUNDLES.map((bundle) => {
    const recommendedTierMeta = tierBy(bundle.recommendedTier);
    const planPriceCents = (recommendedTierMeta?.priceMyr ?? 0) * 100;
    const pricing = computeBundlePricing({
      bundle,
      planPriceCents,
      catalogBySlug,
      currentTier: opts.currentTier,
      activeSlugs: opts.activeSlugs,
      selectedOptionalSlugs: new Set(),
    });

    return {
      bundle,
      pricing,
      recommendedTierLabel: recommendedTierMeta?.label ?? bundle.recommendedTier,
      matchesCurrentTier: opts.currentTier === bundle.recommendedTier,
      tierMeetsRecommendation:
        tierRank(opts.currentTier) >= tierRank(bundle.recommendedTier),
    };
  });
}
