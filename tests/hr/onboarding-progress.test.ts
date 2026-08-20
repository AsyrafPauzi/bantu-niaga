import { describe, expect, it } from "vitest";
import {
  computeOnboardingProgress,
  formatOnboardingProgress,
  onboardingProgressByEmployeeId,
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

  it("groups checklist percent by employee", () => {
    const map = onboardingProgressByEmployeeId([
      { employee_id: "a", is_done: true },
      { employee_id: "a", is_done: false },
      { employee_id: "b", is_done: true },
      { employee_id: "b", is_done: true },
    ]);
    expect(map.get("a")?.percent).toBe(50);
    expect(map.get("b")?.percent).toBe(100);
    expect(map.has("c")).toBe(false);
  });
});
