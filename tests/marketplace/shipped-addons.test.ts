import { describe, expect, it } from "vitest";
import {
  isShippedMarketplaceAddon,
  SHIPPED_MARKETPLACE_ADDON_SLUGS,
} from "@/lib/marketplace/shipped-addons";

describe("shipped marketplace addons", () => {
  it("lists channel integrations as not shipped", () => {
    expect(isShippedMarketplaceAddon("shopee-sync")).toBe(false);
    expect(isShippedMarketplaceAddon("sales-shopee-sync")).toBe(false);
    expect(isShippedMarketplaceAddon("tiktok-sync")).toBe(false);
    expect(isShippedMarketplaceAddon("whatsapp-business")).toBe(false);
    expect(isShippedMarketplaceAddon("lhdn-einvoice")).toBe(false);
  });

  it("lists assistants and credit top-ups as shipped", () => {
    expect(isShippedMarketplaceAddon("finance-assistant")).toBe(true);
    expect(isShippedMarketplaceAddon("boost-credits-300")).toBe(true);
    expect(SHIPPED_MARKETPLACE_ADDON_SLUGS.length).toBeGreaterThan(10);
  });
});
