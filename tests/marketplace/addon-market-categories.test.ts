import { describe, expect, it } from "vitest";
import { addonMarketCategory } from "@/lib/marketplace/addon-market-categories";
import type { MarketplaceAddon } from "@/lib/marketplace/types";

function addon(
  slug: string,
  overrides: Partial<MarketplaceAddon> = {},
): MarketplaceAddon {
  return {
    id: "1",
    slug,
    name: slug,
    short_desc: "",
    long_desc: null,
    pillar: "finance",
    icon: "zap",
    price_cents: 900,
    cadence: "monthly",
    included_in_tier: [],
    is_featured: false,
    sort_order: 1,
    is_coming_soon: false,
    ...overrides,
  };
}

describe("addonMarketCategory", () => {
  it("classifies scale add-ons", () => {
    expect(addonMarketCategory(addon("extra-seat"))).toBe("scale");
    expect(addonMarketCategory(addon("storage-10gb"))).toBe("scale");
  });

  it("classifies automation workflows", () => {
    expect(addonMarketCategory(addon("finance-recurring-invoices"))).toBe(
      "automation",
    );
    expect(addonMarketCategory(addon("marketing-automation"))).toBe(
      "automation",
    );
  });

  it("classifies integrations and usage as others", () => {
    expect(addonMarketCategory(addon("finance-bank-recon"))).toBe("other");
    expect(addonMarketCategory(addon("boost-credits-300"))).toBe("other");
    expect(addonMarketCategory(addon("sales-shopee-sync"))).toBe("other");
  });

  it("infers category from slug patterns when unmapped", () => {
    expect(addonMarketCategory(addon("custom-auto-reorder-pack"))).toBe(
      "automation",
    );
    expect(addonMarketCategory(addon("partner-channel-sync"))).toBe("other");
  });
});
