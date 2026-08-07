import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { grantCredits } from "@/lib/ai/credits";
import type { TierKey } from "@/lib/settings/plans";
import { tierBundledCredits } from "@/lib/settings/tier-agents";

const GRANT_REASON = "subscription_monthly_grant";

/** Grant bundled credits for tier (expire old bundle slice, then re-grant). */
export async function grantTierBundledCredits(
  businessId: string,
  tier: TierKey | string,
  actorUserId?: string | null,
  client?: SupabaseClient,
): Promise<number> {
  const amount = tierBundledCredits(tier);
  if (amount <= 0) return 0;

  if (client) {
    const { data, error } = await client.rpc("settings_grant_credits", {
      p_business_id: businessId,
      p_credits: amount,
      p_reason: GRANT_REASON,
      p_actor_user_id: actorUserId ?? null,
    });
    if (error) throw new Error(error.message);
    return data as number;
  }

  return grantCredits(businessId, amount, GRANT_REASON, actorUserId);
}
