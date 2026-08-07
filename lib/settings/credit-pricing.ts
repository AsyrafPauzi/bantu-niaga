import type { TierKey } from "@/lib/settings/plans";
import { tierBundledCredits } from "@/lib/settings/tier-bundled-credits";

/** Fast Credits retail rate: 100 credits = RM 10. */
export const CREDITS_PER_RM = 10;
export const RM_PER_CREDIT = 0.1;

/** Legacy per-agent grant when addon subscribed (grandfather). */
export const LEGACY_MONTHLY_CREDITS_PER_AGENT = 100;

export const DAILY_BUDGET_MIN_CREDITS = 10;
export const DAILY_BUDGET_MAX_CREDITS = 200;
export const DAILY_BUDGET_DEFAULT_CREDITS = 50;

export function creditsToMyr(credits: number): number {
  return Math.round(credits * RM_PER_CREDIT * 100) / 100;
}

export function myrToCredits(myr: number): number {
  return Math.round(myr * CREDITS_PER_RM);
}

export function clampDailyBudgetCredits(credits: number): number {
  return Math.min(
    DAILY_BUDGET_MAX_CREDITS,
    Math.max(DAILY_BUDGET_MIN_CREDITS, Math.round(credits)),
  );
}

/** Monthly bundled credits for a subscription tier (pricing-plan §6). */
export function monthlyBundledCreditsForTier(tier: TierKey | string): number {
  return tierBundledCredits(tier);
}

/** Total monthly credits bundled for N legacy subscribed agents. */
export function monthlyBundledCredits(subscribedAgentCount: number): number {
  return Math.max(0, subscribedAgentCount) * LEGACY_MONTHLY_CREDITS_PER_AGENT;
}
