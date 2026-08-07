import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import type { TierKey } from "@/lib/settings/plans";
import { tierAmountMyr } from "@/lib/settings/subscription-billing";
import {
  FREE_TIER_EMAILS_PER_MONTH,
  isFreeTier,
} from "@/lib/settings/tier-agents";
import { FreeTierLimitError } from "@/lib/settings/free-tier-limits";

/** Estimated Resend variable cost per outbound email (MYR). */
export const RESEND_COGS_PER_EMAIL_MYR = 0.01;

/** Warn when email COGS exceeds this share of plan MRR (pricing-plan §5.6). */
export const EMAIL_COGS_WARN_MRR_RATIO = 0.15;

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Record an outbound app email (invoice, marketing, etc.).
 * Free tier: hard cap. Paid: unlimited with COGS warn-only logging.
 */
export async function recordOutboundEmailSend(
  supabase: SupabaseClient,
  businessId: string,
  tier: TierKey | string,
): Promise<void> {
  const monthKey = currentMonthKey();

  const { data, error } = await supabase
    .from("business_usage_monthly")
    .select("emails_sent, email_cogs_myr, guardrail_status")
    .eq("business_id", businessId)
    .eq("month", monthKey)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const currentEmails = data?.emails_sent ?? 0;

  if (isFreeTier(tier)) {
    if (currentEmails >= FREE_TIER_EMAILS_PER_MONTH) {
      throw new FreeTierLimitError({
        error: "free_tier_limit",
        limit: "emails",
        message: `Email limit reached (${FREE_TIER_EMAILS_PER_MONTH}/month on Free).`,
        upgrade_tier: "basic",
        current: currentEmails,
        max: FREE_TIER_EMAILS_PER_MONTH,
      });
    }

    const { error: upsertError } = await supabase
      .from("business_usage_monthly")
      .upsert(
        {
          business_id: businessId,
          month: monthKey,
          emails_sent: currentEmails + 1,
        },
        { onConflict: "business_id,month" },
      );

    if (upsertError) throw new Error(upsertError.message);
    return;
  }

  const planMrrMyr = tierAmountMyr(tier as TierKey);
  const emailCogsMyr =
    Number(data?.email_cogs_myr ?? 0) + RESEND_COGS_PER_EMAIL_MYR;
  const emailsSent = currentEmails + 1;

  let guardrailStatus = data?.guardrail_status ?? "ok";
  if (
    planMrrMyr > 0 &&
    emailCogsMyr / planMrrMyr >= EMAIL_COGS_WARN_MRR_RATIO
  ) {
    guardrailStatus = "warn";
    logger.warn("usage.cogs.email_threshold", {
      businessId,
      month: monthKey,
      emailCogsMyr,
      planMrrMyr,
      emailsSent,
      ratio: emailCogsMyr / planMrrMyr,
      message:
        "Email COGS exceeded 15% of plan MRR — warn-only (v1, no throttle).",
    });
  }

  const { error: upsertError } = await supabase.from("business_usage_monthly").upsert(
    {
      business_id: businessId,
      month: monthKey,
      emails_sent: emailsSent,
      email_cogs_myr: emailCogsMyr,
      plan_mrr_myr: planMrrMyr,
      guardrail_status: guardrailStatus,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,month" },
  );

  if (upsertError) throw new Error(upsertError.message);
}
