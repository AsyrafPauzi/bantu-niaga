import { describe, expect, it } from "vitest";
import {
  BUNDLE_ADDON_DISCOUNT_RATE,
  BUSINESS_BUNDLES,
  bundleForBusinessType,
  computeBundlePricing,
} from "@/lib/onboarding/business-bundles";

describe("business bundles", () => {
  it("maps retail to Pakej Kedai Runcit (Solo)", () => {
    const bundle = bundleForBusinessType("retail");
    expect(bundle?.id).toBe("pakej-kedai-runcit");
    expect(bundle?.recommendedTier).toBe("micro");
  });

  it("maps online sellers to Pakej Penjual Online", () => {
    const bundle = bundleForBusinessType("online");
    expect(bundle?.id).toBe("pakej-penjual-online");
  });

  it("does not bundle plan-included AI agents", () => {
    for (const bundle of BUSINESS_BUNDLES) {
      const slugs = bundle.addons.map((a) => a.slug);
      expect(slugs).not.toContain("hr-assistant");
      expect(slugs).not.toContain("marketing-assistant");
    }
  });

  it("computes 15% savings on add-on subtotal", () => {
    const bundle = bundleForBusinessType("fnb");
    expect(bundle).not.toBeNull();

    const catalogBySlug = new Map([
      [
        "hr-staff-portal",
        {
          name: "Staff portal",
          price_cents: 900,
          cadence: "monthly",
          included_in_tier: [],
          is_coming_soon: false,
        },
      ],
    ]);

    const pricing = computeBundlePricing({
      bundle: bundle!,
      planPriceCents: 7900,
      catalogBySlug,
      currentTier: "micro",
      activeSlugs: new Set(),
      selectedOptionalSlugs: new Set(),
    });

    expect(pricing.addonSubtotalCents).toBe(900);
    expect(pricing.bundleAddonSubtotalCents).toBe(
      Math.round(900 * (1 - BUNDLE_ADDON_DISCOUNT_RATE)),
    );
    expect(pricing.savingsCents).toBe(900 - pricing.bundleAddonSubtotalCents);
    expect(pricing.totalBundleCents).toBe(
      pricing.planPriceCents + pricing.bundleAddonSubtotalCents,
    );
  });

  it("excludes coming-soon catalog prices from purchasable subtotal", () => {
    const bundle = bundleForBusinessType("fnb");
    const catalogBySlug = new Map([
      [
        "hr-staff-portal",
        {
          name: "Staff portal",
          price_cents: 900,
          cadence: "monthly",
          included_in_tier: [],
          is_coming_soon: false,
        },
      ],
      [
        "customer-booking-page",
        {
          name: "Booking page",
          price_cents: 900,
          cadence: "monthly",
          included_in_tier: [],
          is_coming_soon: true,
        },
      ],
      [
        "sales-daily-closeout",
        {
          name: "Daily closeout",
          price_cents: 1400,
          cadence: "monthly",
          included_in_tier: [],
          is_coming_soon: true,
        },
      ],
    ]);

    const pricing = computeBundlePricing({
      bundle: bundle!,
      planPriceCents: 7900,
      catalogBySlug,
      currentTier: "micro",
      activeSlugs: new Set(),
      selectedOptionalSlugs: new Set(),
    });

    expect(pricing.addonSubtotalCents).toBe(900);
    expect(pricing.allStackComingSoon).toBe(false);
    expect(pricing.purchasableLineCount).toBe(1);
  });

  it("treats shipped add-ons as ready even if catalog flag is stale", () => {
    const bundle = bundleForBusinessType("retail");
    const catalogBySlug = new Map([
      [
        "storage-10gb",
        {
          name: "Storage 10GB",
          price_cents: 500,
          cadence: "monthly",
          included_in_tier: [],
          is_coming_soon: true,
        },
      ],
      [
        "hr-staff-portal",
        {
          name: "Staff portal",
          price_cents: 900,
          cadence: "monthly",
          included_in_tier: [],
          is_coming_soon: false,
        },
      ],
    ]);

    const pricing = computeBundlePricing({
      bundle: bundle!,
      planPriceCents: 7900,
      catalogBySlug,
      currentTier: "micro",
      activeSlugs: new Set(),
      selectedOptionalSlugs: new Set(),
    });

    const storage = pricing.lines.find((l) => l.slug === "storage-10gb");
    expect(storage?.comingSoon).toBe(false);
    expect(pricing.purchasableLineCount).toBeGreaterThan(0);
  });

  it("marks allStackComingSoon when no shipped stack lines exist", () => {
    const bundle = bundleForBusinessType("online");
    const catalogBySlug = new Map([
      [
        "marketing-automation",
        {
          name: "Marketing automation",
          price_cents: 1100,
          cadence: "monthly",
          included_in_tier: [],
          is_coming_soon: true,
        },
      ],
      [
        "shopee-sync",
        {
          name: "Shopee sync",
          price_cents: 1400,
          cadence: "monthly",
          included_in_tier: [],
          is_coming_soon: true,
        },
      ],
    ]);

    const pricing = computeBundlePricing({
      bundle: {
        ...bundle!,
        addons: [
          { slug: "marketing-automation" },
          { slug: "shopee-sync" },
        ],
      },
      planPriceCents: 7900,
      catalogBySlug,
      currentTier: "micro",
      activeSlugs: new Set(),
      selectedOptionalSlugs: new Set(),
    });

    expect(pricing.allStackComingSoon).toBe(true);
    expect(pricing.purchasableLineCount).toBe(0);
    expect(pricing.addonSubtotalCents).toBe(0);
  });

  it("fnb bundle no longer includes payroll addon (payroll is HR core)", () => {
    const bundle = bundleForBusinessType("fnb");
    expect(
      bundle!.addons.some((a) => a.slug === "hr-payroll-statutory"),
    ).toBe(false);
    expect(bundle!.addons.some((a) => a.slug === "hr-staff-portal")).toBe(true);
  });
});
