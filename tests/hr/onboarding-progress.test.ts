import { describe, expect, it } from "vitest";
import {
  computeOnboardingProgress,
  formatOnboardingProgress,
  onboardingProgressFromCounts,
} from "@/lib/hr/onboarding-progress";

describe("onboarding progress", () => {
  it("computes done, open, and percent from items", () => {
    expect(
      computeOnboardingProgress([
        { is_done: true },
        { is_done: false },
        { is_done: true },
      ]),
    ).toEqual({
      total: 3,
      done: 2,
      open: 1,
      percent: 67,
    });
  });

  it("formats progress for empty and complete lists", () => {
    expect(formatOnboardingProgress(computeOnboardingProgress([]))).toBe(
      "No checklist items yet",
    );
    expect(
      formatOnboardingProgress(
        computeOnboardingProgress([{ is_done: true }, { is_done: true }]),
      ),
    ).toBe("All 2 complete");
    expect(
      formatOnboardingProgress(
        computeOnboardingProgress([{ is_done: true }, { is_done: false }]),
      ),
    ).toBe("1 of 2 done · 1 remaining");
  });

  it("builds progress from aggregate counts", () => {
    expect(onboardingProgressFromCounts(3, 6)).toEqual({
      total: 6,
      done: 3,
      open: 3,
      percent: 50,
    });
  });
});
