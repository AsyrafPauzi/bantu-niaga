import { describe, expect, it } from "vitest";
import { filterTenantCatalog } from "@/lib/marketplace/catalog-filter";
import type { CatalogEntry } from "@/lib/marketplace/types";

function entry(
  slug: string,
  comingSoon: boolean,
): CatalogEntry {
  return {
    addon: {
      id: slug,
      slug,
      name: slug,
      short_desc: "",
      long_desc: "",
      pillar: "admin",
      icon: "sparkles",
      price_cents: 0,
      cadence: "monthly",
      included_in_tier: [],
      is_featured: false,
      sort_order: 0,
      is_coming_soon: comingSoon,
    },
    activation: null,
  };
}

describe("filterTenantCatalog", () => {
  it("hides coming soon and unshipped by default", () => {
    const rows = [
      entry("admin-assistant", false),
      entry("whatsapp-business", true),
      entry("not-a-real-slug", false),
    ];
    const filtered = filterTenantCatalog(rows, { showPlanned: false });
    expect(filtered.map((e) => e.addon.slug)).toEqual(["admin-assistant"]);
  });

  it("keeps all when showPlanned", () => {
    const rows = [entry("whatsapp-business", true)];
    expect(filterTenantCatalog(rows, { showPlanned: true })).toHaveLength(1);
  });
});
