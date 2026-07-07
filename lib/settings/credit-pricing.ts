/** Fast Credits retail rate: 200 credits = RM 20. */
export const CREDITS_PER_RM = 10;
export const RM_PER_CREDIT = 0.1;

/** Bundled with each subscribed module AI assistant per month. */
export const MONTHLY_CREDITS_PER_AGENT = 100;

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

/** Total monthly credits bundled for N subscribed module AI assistants. */
export function monthlyBundledCredits(subscribedAgentCount: number): number {
  return Math.max(0, subscribedAgentCount) * MONTHLY_CREDITS_PER_AGENT;
}
