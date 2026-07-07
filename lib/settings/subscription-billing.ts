import type { SupabaseClient } from "@supabase/supabase-js";

import type { TierKey } from "@/lib/settings/plans";

/** Free (starter) and paid plans bill on a 30-day cycle. */
export const MONTHLY_RENEWAL_DAYS = 30;

/** Starter trial length in days. */
export const TRIAL_RENEWAL_DAYS = 14;

export function addDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function subscriptionPeriodLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("en-MY", {
    month: "short",
    year: "numeric",
  }).format(date);
}

export function tierAmountMyr(tier: TierKey): number {
  switch (tier) {
    case "starter":
      return 0;
    case "micro":
      return 69;
    case "sme":
      return 139;
    case "enterprise":
      return 249;
    default:
      return 0;
  }
}

export interface IssueSubscriptionInvoiceInput {
  businessId: string;
  userId?: string | null;
  periodLabel?: string;
  amountMyr?: number;
}

/** Creates a paid subscription tax invoice via Postgres RPC. */
export async function issueSubscriptionInvoice(
  supabase: SupabaseClient,
  input: IssueSubscriptionInvoiceInput,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("settings_issue_subscription_invoice", {
    p_business_id: input.businessId,
    p_user_id: input.userId ?? null,
    p_period_label: input.periodLabel ?? null,
    p_amount_myr: input.amountMyr ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return typeof data === "string" ? data : null;
}

export function freePlanRenewalAt(): string {
  return addDaysFromNow(MONTHLY_RENEWAL_DAYS);
}

export function trialRenewalAt(): string {
  return addDaysFromNow(TRIAL_RENEWAL_DAYS);
}
