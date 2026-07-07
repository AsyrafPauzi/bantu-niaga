import { describe, expect, it } from "vitest";
import { recommendPlanFromQuiz } from "@/lib/onboarding/plan-quiz";

describe("recommendPlanFromQuiz", () => {
  it("recommends Free for solo freelancer", () => {
    const result = recommendPlanFromQuiz({
      businessType: "freelancer",
      teamSize: "solo",
      priorities: ["invoices"],
    });
    expect(result.recommendedTier).toBe("starter");
    expect(result.canStayFree).toBe(true);
  });

  it("recommends Growth when leave is a priority for a team", () => {
    const result = recommendPlanFromQuiz({
      businessType: "fnb",
      teamSize: "6-15",
      priorities: ["leave", "pos"],
    });
    expect(result.recommendedTier).toBe("sme");
    expect(result.canStayFree).toBe(false);
  });

  it("recommends Starter for small retail with stock focus", () => {
    const result = recommendPlanFromQuiz({
      businessType: "retail",
      teamSize: "2-5",
      priorities: ["stock"],
    });
    expect(result.recommendedTier).toBe("micro");
  });
});
