import { describe, expect, it } from "vitest";

import {
  tierBundledCredits,
  planIncludesAgentSlug,
  FREE_TIER_INVOICES_PER_MONTH,
} from "@/lib/settings/tier-agents";
import {
  MONTHLY_RENEWAL_DAYS,
  TRIAL_RENEWAL_DAYS,
  tierAmountMyr,
} from "@/lib/settings/subscription-billing";
import { hasPillar, minimumTierFor } from "@/lib/auth/entitlements";

describe("subscription billing", () => {
  it("prices tiers in MYR (pricing-plan v2026-08)", () => {
    expect(tierAmountMyr("starter")).toBe(0);
    expect(tierAmountMyr("basic")).toBe(39);
    expect(tierAmountMyr("micro")).toBe(79);
    expect(tierAmountMyr("sme")).toBe(169);
    expect(tierAmountMyr("enterprise")).toBe(299);
  });

  it("uses 30-day free cycle and 7-day trial", () => {
    expect(MONTHLY_RENEWAL_DAYS).toBe(30);
    expect(TRIAL_RENEWAL_DAYS).toBe(7);
  });
});

describe("tier agents", () => {
  it("bundles credits by tier", () => {
    expect(tierBundledCredits("starter")).toBe(0);
    expect(tierBundledCredits("basic")).toBe(60);
    expect(tierBundledCredits("micro")).toBe(120);
    expect(tierBundledCredits("sme")).toBe(180);
    expect(tierBundledCredits("enterprise")).toBe(360);
  });

  it("includes three agents on Basic", () => {
    expect(planIncludesAgentSlug("basic", "admin-assistant")).toBe(true);
    expect(planIncludesAgentSlug("basic", "sales-assistant")).toBe(true);
    expect(planIncludesAgentSlug("basic", "finance-assistant")).toBe(true);
    expect(planIncludesAgentSlug("basic", "hr-assistant")).toBe(false);
  });
});

describe("entitlements", () => {
  it("Basic unlocks admin, sales, finance only", () => {
    expect(hasPillar("basic", "admin")).toBe(true);
    expect(hasPillar("basic", "sales")).toBe(true);
    expect(hasPillar("basic", "finance")).toBe(true);
    expect(hasPillar("basic", "operations")).toBe(false);
    expect(minimumTierFor("operations")).toBe("micro");
  });

  it("Solo+ unlocks all pillars", () => {
    expect(hasPillar("micro", "marketing")).toBe(true);
    expect(hasPillar("micro", "hr")).toBe(true);
  });
});

describe("free tier limits constants", () => {
  it("matches pricing plan", () => {
    expect(FREE_TIER_INVOICES_PER_MONTH).toBe(25);
  });
});
