import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  billplzCallbackUrl,
  createBillplzBill,
} from "@/lib/integrations/billplz";
import { isBillplzConfigured } from "@/lib/settings/billing";
import { BillplzNotConfiguredError } from "@/lib/settings/require-billplz-prod";
import {
  subscriptionBillDescription,
  tierAmountMyr,
} from "@/lib/settings/subscription-billing";
import type { TierKey } from "@/lib/settings/plans";

export { subscriptionBillDescription } from "@/lib/settings/subscription-billing";

export interface StartSubscriptionCheckoutInput {
  supabase: SupabaseClient;
  businessId: string;
  userId: string;
  pendingTier: TierKey;
  amountMyr: number;
  payerEmail: string;
  payerName: string;
  cadence?: "monthly" | "annual";
}

export interface StartSubscriptionCheckoutResult {
  checkout_url: string;
  billplz_id: string;
  invoice_id: string | null;
  intent_id: string | null;
  pending: true;
  tier: TierKey;
  amount_myr: number;
}

export async function startSubscriptionCheckout(
  input: StartSubscriptionCheckoutInput,
): Promise<StartSubscriptionCheckoutResult> {
  if (!isBillplzConfigured()) {
    throw new BillplzNotConfiguredError();
  }

  const cadence = input.cadence ?? "monthly";
  const collectionId = process.env.BILLPLZ_COLLECTION_ID!.trim();
  const amountCents = Math.round(input.amountMyr * 100);
  if (amountCents < 100) {
    throw new Error("Minimum subscription payment is RM 1.00.");
  }

  const cadenceNote = cadence === "annual" ? " — annual (2 months free)" : " — monthly";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

  let bill;
  try {
    bill = await createBillplzBill({
      collectionId,
      email: input.payerEmail,
      name: input.payerName,
      amountCents,
      description: subscriptionBillDescription(input.pendingTier) + cadenceNote,
      callbackUrl: billplzCallbackUrl(),
      redirectUrl: appUrl
        ? `${appUrl}/settings/subscription?paid=1`
        : undefined,
      reference1: input.businessId,
      reference2: input.pendingTier,
    });
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "Failed to create Billplz bill",
    );
  }

  const { data: pending, error: pendingErr } = await input.supabase.rpc(
    "settings_create_subscription_pending",
    {
      p_business_id:     input.businessId,
      p_tier:            input.pendingTier,
      p_amount_myr:      input.amountMyr,
      p_user_id:         input.userId,
      p_billplz_id:      bill.id,
      p_billplz_url:     bill.url,
      p_billing_cadence: cadence,
    },
  );

  if (pendingErr || !pending) {
    throw new Error(
      pendingErr?.message ?? "Could not create pending subscription invoice",
    );
  }

  const row = Array.isArray(pending) ? pending[0] : pending;

  return {
    checkout_url: bill.url,
    billplz_id: bill.id,
    invoice_id: row?.invoice_id ?? null,
    intent_id: row?.intent_id ?? null,
    pending: true,
    tier: input.pendingTier,
    amount_myr: input.amountMyr,
  };
}

export function paidTierAmountMyr(tier: TierKey): number {
  return tierAmountMyr(tier);
}
