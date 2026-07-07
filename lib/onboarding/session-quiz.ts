import type { PlanQuizAnswers } from "@/lib/onboarding/plan-quiz";

export const ONBOARDING_QUIZ_STORAGE_KEY = "bn_onboarding_quiz";

export function readQuizFromSession(): PlanQuizAnswers | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ONBOARDING_QUIZ_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlanQuizAnswers;
    if (!parsed.businessType || !parsed.teamSize) return null;
    return {
      businessType: parsed.businessType,
      teamSize: parsed.teamSize,
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
    };
  } catch {
    return null;
  }
}

export function writeQuizToSession(answers: PlanQuizAnswers): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ONBOARDING_QUIZ_STORAGE_KEY, JSON.stringify(answers));
}

export function clearQuizSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ONBOARDING_QUIZ_STORAGE_KEY);
}
