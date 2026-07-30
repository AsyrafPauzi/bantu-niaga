import type { OnboardingQuizInput } from "@/lib/onboarding/schemas";
import type { PlanQuizAnswers } from "@/lib/onboarding/plan-quiz";

/**
 * Used when the owner skips `/sign-up/guide` so recommendation still has
 * sensible plan + bundle defaults (Pakej Team Kecil / Free-first path).
 */
export const DEFAULT_GENERIC_QUIZ_ANSWERS: PlanQuizAnswers = {
  businessType: "other",
  teamSize: "solo",
  priorities: ["invoices"],
};

export function planQuizToDbPayload(
  answers: PlanQuizAnswers,
): OnboardingQuizInput {
  return {
    business_type: answers.businessType,
    team_size_band: answers.teamSize,
    priorities: answers.priorities,
  };
}

export function dbRowToPlanQuiz(row: {
  business_type: string | null;
  team_size_band: string | null;
  onboarding_priorities: unknown;
}): PlanQuizAnswers | null {
  if (!row.business_type || !row.team_size_band) return null;
  const priorities = Array.isArray(row.onboarding_priorities)
    ? (row.onboarding_priorities as PlanQuizAnswers["priorities"])
    : [];
  return {
    businessType: row.business_type as PlanQuizAnswers["businessType"],
    teamSize: row.team_size_band as PlanQuizAnswers["teamSize"],
    priorities,
  };
}

/** Session, DB, or generic default — never null. */
export function resolveOnboardingQuizAnswers(
  answers: PlanQuizAnswers | null | undefined,
): PlanQuizAnswers {
  return answers ?? DEFAULT_GENERIC_QUIZ_ANSWERS;
}

export function isOnboardingQuizPersisted(row: {
  business_type: string | null;
  team_size_band: string | null;
}): boolean {
  return Boolean(row.business_type && row.team_size_band);
}
