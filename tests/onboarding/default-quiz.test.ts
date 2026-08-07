import { describe, expect, it } from "vitest";
import { bundleForQuizAnswers } from "@/lib/onboarding/business-bundles";
import {
  DEFAULT_GENERIC_QUIZ_ANSWERS,
  dbRowToPlanQuiz,
  isOnboardingQuizPersisted,
  planQuizToDbPayload,
  resolveOnboardingQuizAnswers,
} from "@/lib/onboarding/default-quiz";
import { recommendPlanFromQuiz } from "@/lib/onboarding/plan-quiz";

describe("default onboarding quiz", () => {
  it("resolves null answers to the generic default", () => {
    expect(resolveOnboardingQuizAnswers(null)).toEqual(
      DEFAULT_GENERIC_QUIZ_ANSWERS,
    );
  });

  it("maps defaults to DB payload", () => {
    expect(planQuizToDbPayload(DEFAULT_GENERIC_QUIZ_ANSWERS)).toEqual({
      business_type: "other",
      team_size_band: "solo",
      priorities: ["invoices"],
    });
  });

  it("detects missing persisted quiz on a business row", () => {
    expect(
      isOnboardingQuizPersisted({
        business_type: null,
        team_size_band: null,
      }),
    ).toBe(false);
    expect(
      isOnboardingQuizPersisted({
        business_type: "retail",
        team_size_band: "solo",
      }),
    ).toBe(true);
  });

  it("round-trips DB rows into plan quiz answers", () => {
    expect(
      dbRowToPlanQuiz({
        business_type: "fnb",
        team_size_band: "6-15",
        onboarding_priorities: ["leave", "pos"],
      }),
    ).toEqual({
      businessType: "fnb",
      teamSize: "6-15",
      priorities: ["leave", "pos"],
    });
  });

  it("yields a generic free-first recommendation and team bundle", () => {
    const result = recommendPlanFromQuiz(DEFAULT_GENERIC_QUIZ_ANSWERS);
    expect(result.canStayFree).toBe(true);
    expect(result.recommendedTier).toBe("starter");

    const bundle = bundleForQuizAnswers(DEFAULT_GENERIC_QUIZ_ANSWERS);
    expect(bundle?.id).toBe("pakej-team-hr");
  });
});
