import { isShippedMarketplaceAddon } from "@/lib/marketplace/shipped-addons";
import type { CatalogEntry } from "@/lib/marketplace/types";

export function filterTenantCatalog(
  entries: CatalogEntry[],
  opts: { showPlanned: boolean },
): CatalogEntry[] {
  if (opts.showPlanned) {
    return entries;
  }
  return entries.filter(
    (e) =>
      !e.addon.is_coming_soon && isShippedMarketplaceAddon(e.addon.slug),
  );
}

export function marketplaceShowPlanned(): boolean {
  return process.env.MARKETPLACE_SHOW_PLANNED === "true";
}
