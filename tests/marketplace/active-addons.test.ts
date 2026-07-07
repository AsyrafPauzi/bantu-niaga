import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/lib/marketplace/types";
import {
  addonStatusLine,
  isAddonActive,
  resolveNextChargeDate,
} from "@/lib/marketplace/active-addons";

const baseAddon = {
  id: "a1",
  slug: "lhdn-einvoice",
  name: "LHDN e-Invoice connector",
  short_desc: "MyInvois",
  long_desc: null,
  pillar: "finance" as const,
  icon: "file-check",
  price_cents: 0,
  cadence: "included" as const,
  included_in_tier: ["sme", "enterprise"],
  is_featured: false,
  sort_order: 1,
  is_coming_soon: false,
};

describe("isAddonActive", () => {
  it("treats tier-included add-ons as active without a purchase row", () => {
    const entry: CatalogEntry = { addon: baseAddon, activation: null };
    expect(isAddonActive(entry, "enterprise")).toBe(true);
    expect(isAddonActive(entry, "micro")).toBe(false);
  });
});

describe("addonStatusLine", () => {
  it("shows renewal dates from activation rows", () => {
    const entry: CatalogEntry = {
      addon: { ...baseAddon, slug: "hr-assistant", cadence: "monthly" },
      activation: {
        id: "b1",
        business_id: "biz",
        addon_id: "a1",
        status: "active",
        activated_at: "2026-07-06T00:00:00.000Z",
        next_charge_at: "2026-08-05T00:00:00.000Z",
        cancel_at: null,
        qty: 1,
        meta: {},
      },
    };
    expect(addonStatusLine(entry, "enterprise", "Pro")).toContain("renews");
  });

  it("shows included plan copy for tier bundles", () => {
    const entry: CatalogEntry = { addon: baseAddon, activation: null };
    expect(addonStatusLine(entry, "enterprise", "Pro")).toBe(
      "Included in your Pro plan",
    );
  });
});

describe("resolveNextChargeDate", () => {
  it("prefers subscription renewal over addon dates", () => {
    const date = resolveNextChargeDate("2026-07-14T00:00:00.000Z", []);
    expect(date).toBe("2026-07-14T00:00:00.000Z");
  });
});
