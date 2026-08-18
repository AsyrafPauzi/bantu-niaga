import { describe, expect, it } from "vitest";
import {
  MONTHLY_RENEWAL_DAYS,
  TRIAL_RENEWAL_DAYS,
  tierAmountMyr,
} from "@/lib/settings/subscription-billing";

describe("subscription billing", () => {
  it("prices tiers in MYR", () => {
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
