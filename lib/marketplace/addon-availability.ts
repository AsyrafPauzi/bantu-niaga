import "server-only";

import { loadCatalog } from "@/lib/marketplace/load";
import type { CatalogEntry } from "@/lib/marketplace/types";

export interface AddonFeatureState {
  slug: string;
  active: boolean;
  comingSoon: boolean;
  purchasable: boolean;
  /** User can open and use the feature (addon activated). */
  accessible: boolean;
  /** UI should block navigation — not active and not yet available to buy. */
  navDisabled: boolean;
}

function stateFromEntry(slug: string, entry: CatalogEntry | undefined): AddonFeatureState {
  const active =
    entry?.activation?.status === "active" ||
    entry?.activation?.status === "pending_cancel";
  const comingSoon = entry?.addon.is_coming_soon ?? true;
  const purchasable = !!entry && !comingSoon;

  return {
    slug,
    active,
    comingSoon,
    purchasable,
    accessible: active,
    navDisabled: !active && comingSoon,
  };
}

export async function loadAddonFeatureState(
  _businessId: string,
  slug: string,
): Promise<AddonFeatureState> {
  const catalog = await loadCatalog();
  const entry = catalog.find((row) => row.addon.slug === slug);
  return stateFromEntry(slug, entry);
}

export async function loadAddonFeatureStates(
  _businessId: string,
  slugs: readonly string[],
): Promise<Record<string, AddonFeatureState>> {
  const catalog = await loadCatalog();
  const bySlug = new Map(catalog.map((row) => [row.addon.slug, row]));

  const out: Record<string, AddonFeatureState> = {};
  for (const slug of slugs) {
    out[slug] = stateFromEntry(slug, bySlug.get(slug));
  }
  return out;
}

export function isAddonPurchasable(addon: { is_coming_soon: boolean }): boolean {
  return !addon.is_coming_soon;
}
