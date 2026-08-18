import { describe, expect, it } from "vitest";
import { shouldOfferBasicTrial } from "@/lib/settings/basic-trial";

describe("shouldOfferBasicTrial", () => {
  const eligible = {
    isSaas: true,
    role: "owner",
    tier: "starter",
    subscriptionStatus: "active",
    selfServeTrialUsedAt: null as string | null,
  };

  it("is true for SaaS Free owner who never trialed", () => {
    expect(shouldOfferBasicTrial(eligible)).toBe(true);
  });

  it("is false when trial was already used", () => {
    expect(
      shouldOfferBasicTrial({
        ...eligible,
        selfServeTrialUsedAt: "2026-08-01T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("is false for standalone, non-owner, trial, or paid tier", () => {
    expect(shouldOfferBasicTrial({ ...eligible, isSaas: false })).toBe(false);
    expect(shouldOfferBasicTrial({ ...eligible, role: "manager" })).toBe(false);
    expect(
      shouldOfferBasicTrial({ ...eligible, subscriptionStatus: "trial" }),
    ).toBe(false);
    expect(shouldOfferBasicTrial({ ...eligible, tier: "basic" })).toBe(false);
  });
});
