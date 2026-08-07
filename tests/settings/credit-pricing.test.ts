import { describe, expect, it } from "vitest";
import {
  LEGACY_MONTHLY_CREDITS_PER_AGENT,
  monthlyBundledCreditsForTier,
} from "@/lib/settings/credit-pricing";

describe("credit pricing", () => {
  it("legacy per-agent grant for marketplace addons", () => {
    expect(LEGACY_MONTHLY_CREDITS_PER_AGENT).toBe(100);
  });

  it("tier bundled credits", () => {
    expect(monthlyBundledCreditsForTier("basic")).toBe(60);
    expect(monthlyBundledCreditsForTier("micro")).toBe(120);
  });
});
