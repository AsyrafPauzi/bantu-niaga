import { describe, expect, it } from "vitest";
import {
  BUNDLE_ADDON_DISCOUNT_RATE,
  bundleForBusinessType,
  computeBundlePricing,
} from "@/lib/onboarding/business-bundles";

describe("business bundles", () => {
  it("maps retail to Pakej Kedai", () => {
    const bundle = bundleForBusinessType("retail");
    expect(bundle?.id).toBe("pakej-kedai");
    expect(bundle?.recommendedTier).toBe("sme");
  });

  it("computes 10% savings on add-on subtotal", () => {
    const bundle = bundleForBusinessType("fnb");
    expect(bundle).not.toBeNull();

    const catalogBySlug = new Map([
      [
        "hr-assistant",
        {
          name: "HR Assistant",
          price_cents: 2000,
          cadence: "monthly",
          included_in_tier: [],
          is_coming_soon: false,
        },
      ],
    ]);

    const pricing = computeBundlePricing({
      bundle: bundle!,
      planPriceCents: 13900,
      catalogBySlug,
      currentTier: "sme",
      activeSlugs: new Set(),
      selectedOptionalSlugs: new Set(),
    });

    expect(pricing.addonSubtotalCents).toBe(2000);
    expect(pricing.bundleAddonSubtotalCents).toBe(
      Math.round(2000 * (1 - BUNDLE_ADDON_DISCOUNT_RATE)),
    );
    expect(pricing.savingsCents).toBe(2000 - pricing.bundleAddonSubtotalCents);
    expect(pricing.totalBundleCents).toBe(
      pricing.planPriceCents + pricing.bundleAddonSubtotalCents,
    );
  });

  it("excludes optional payroll unless selected", () => {
    const bundle = bundleForBusinessType("fnb");
    const catalogBySlug = new Map([
      [
        "hr-assistant",
        {
          name: "HR Assistant",
          price_cents: 2000,
          cadence: "monthly",
          included_in_tier: [],
          is_coming_soon: false,
        },
      ],
      [
        "hr-payroll-pack",
        {
          name: "Payroll Pack",
          price_cents: 9900,
          cadence: "monthly",
          included_in_tier: [],
          is_coming_soon: true,
        },
      ],
    ]);

    const withoutPayroll = computeBundlePricing({
      bundle: bundle!,
      planPriceCents: 13900,
      catalogBySlug,
      currentTier: "sme",
      activeSlugs: new Set(),
      selectedOptionalSlugs: new Set(),
    });

    const withPayroll = computeBundlePricing({
      bundle: bundle!,
      planPriceCents: 13900,
      catalogBySlug,
      currentTier: "sme",
      activeSlugs: new Set(),
      selectedOptionalSlugs: new Set(["hr-payroll-pack"]),
    });

    expect(withoutPayroll.lines.some((l) => l.slug === "hr-payroll-pack")).toBe(
      false,
    );
    expect(withPayroll.lines.some((l) => l.slug === "hr-payroll-pack")).toBe(true);
  });
});
