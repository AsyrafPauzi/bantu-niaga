import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadActiveAiAgentSlugs } from "@/lib/ai/boardroom";
import {
  LEGACY_MONTHLY_CREDITS_PER_AGENT,
  monthlyBundledCredits,
  monthlyBundledCreditsForTier,
} from "@/lib/settings/credit-pricing";
import { loadBusinessTier } from "@/lib/settings/load-business-tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CreditRolloverPolicy {
  total_balance: number;
  topup_balance: number;
  bundle_balance: number;
  monthly_credits_per_agent: number;
  active_ai_agents: number;
  max_monthly_bundle: number;
  subscription_renewal_at: string | null;
  next_ai_addon_renewal_at: string | null;
  policy: {
    topup_rolls_over: true;
    monthly_bundle_rolls_over: false;
    spend_order: "bundle_first";
  };
}

export function computeBundleBalance(
  totalBalance: number,
  topupBalance: number,
): number {
  return Math.max(0, totalBalance - Math.max(0, topupBalance));
}

/** Preview balance after monthly bundle grant (expire up to grant, then re-grant). */
export function previewMonthlyRenewalBalance(
  totalBalance: number,
  topupBalance: number,
  grantCredits: number = LEGACY_MONTHLY_CREDITS_PER_AGENT,
): number {
  const bundle = computeBundleBalance(totalBalance, topupBalance);
  const newBundle = Math.max(0, bundle - grantCredits) + grantCredits;
  return topupBalance + newBundle;
}

export async function loadCreditRolloverPolicy(
  businessId: string,
  client?: SupabaseClient,
): Promise<CreditRolloverPolicy> {
  const supabase = client ?? (await createSupabaseServerClient());

  const [businessRes, activeSlugs, addonsRes, tier] = await Promise.all([
    supabase
      .from("businesses")
      .select("credit_balance, credit_topup_balance, subscription_renewal_at")
      .eq("id", businessId)
      .maybeSingle(),
    loadActiveAiAgentSlugs(businessId, supabase),
    supabase
      .from("business_addons")
      .select("next_charge_at, marketplace_addons!inner(slug)")
      .eq("business_id", businessId)
      .eq("status", "active"),
    loadBusinessTier(businessId, supabase),
  ]);

  if (businessRes.error) throw new Error(businessRes.error.message);
  if (addonsRes.error) throw new Error(addonsRes.error.message);

  const business = businessRes.data as
    | {
        credit_balance: number;
        credit_topup_balance: number | null;
        subscription_renewal_at: string | null;
      }
    | null;

  const total = business?.credit_balance ?? 0;
  const topup = Math.max(0, business?.credit_topup_balance ?? 0);
  const topupCapped = Math.min(topup, total);

  const tierBundle = monthlyBundledCreditsForTier(tier);
  const legacyBundle = monthlyBundledCredits(activeSlugs.size);
  const maxMonthlyBundle = Math.max(tierBundle, legacyBundle);

  const renewalDates = (addonsRes.data ?? [])
    .filter((row) => {
      const addon = row.marketplace_addons as unknown as { slug: string };
      return activeSlugs.has(addon.slug);
    })
    .map((row) => row.next_charge_at as string | null)
    .filter((d): d is string => Boolean(d))
    .sort();

  return {
    total_balance: total,
    topup_balance: topupCapped,
    bundle_balance: computeBundleBalance(total, topupCapped),
    monthly_credits_per_agent: LEGACY_MONTHLY_CREDITS_PER_AGENT,
    active_ai_agents: activeSlugs.size,
    max_monthly_bundle: maxMonthlyBundle,
    subscription_renewal_at: business?.subscription_renewal_at ?? null,
    next_ai_addon_renewal_at: renewalDates[0] ?? null,
    policy: {
      topup_rolls_over: true,
      monthly_bundle_rolls_over: false,
      spend_order: "bundle_first",
    },
  };
}
