import { describe, expect, it } from "vitest";
import {
  computeBundleBalance,
  previewMonthlyRenewalBalance,
} from "@/lib/settings/credit-rollover";

describe("computeBundleBalance", () => {
  it("subtracts top-up from total", () => {
    expect(computeBundleBalance(150, 50)).toBe(100);
    expect(computeBundleBalance(40, 50)).toBe(0);
  });
});

describe("previewMonthlyRenewalBalance", () => {
  it("expires up to 100 bundle credits then re-grants 100", () => {
    expect(previewMonthlyRenewalBalance(80, 0, 100)).toBe(100);
    expect(previewMonthlyRenewalBalance(300, 0, 100)).toBe(300);
    expect(previewMonthlyRenewalBalance(120, 50, 100)).toBe(150);
  });

  it("preserves top-up balance across renewal", () => {
    expect(previewMonthlyRenewalBalance(150, 50, 100)).toBe(150);
  });
});
