import { describe, expect, it } from "vitest";
import {
  creditsToMyr,
  DAILY_BUDGET_DEFAULT_CREDITS,
  monthlyBundledCredits,
  MONTHLY_CREDITS_PER_AGENT,
  myrToCredits,
} from "@/lib/settings/credit-pricing";

describe("credit pricing (100 credits = RM 20)", () => {
  it("converts 100 credits to RM 20", () => {
    expect(creditsToMyr(100)).toBe(20);
  });

  it("converts RM 5 to 25 credits", () => {
    expect(myrToCredits(5)).toBe(25);
  });

  it("default daily budget is 25 credits (RM 5)", () => {
    expect(DAILY_BUDGET_DEFAULT_CREDITS).toBe(25);
    expect(creditsToMyr(DAILY_BUDGET_DEFAULT_CREDITS)).toBe(5);
  });

  it("bundles 100 credits per subscribed agent into the shared monthly pool", () => {
    expect(MONTHLY_CREDITS_PER_AGENT).toBe(100);
    expect(monthlyBundledCredits(6)).toBe(600);
    expect(monthlyBundledCredits(0)).toBe(0);
  });
});
