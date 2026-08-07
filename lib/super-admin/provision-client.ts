import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { ensureMembership } from "@/lib/auth/memberships";
import { authCallbackUrl } from "@/lib/auth/site-url";
import {
  freePlanRenewalAt,
  issueSubscriptionInvoice,
  subscriptionPeriodLabel,
} from "@/lib/settings/subscription-billing";
import { grantTierBundledCredits } from "@/lib/settings/subscription-credits";
import type { TierKey } from "@/lib/settings/plans";
import { tierBundledCredits } from "@/lib/settings/tier-agents";

const provisionSchema = z
  .object({
    business_name: z.string().trim().min(2).max(120),
    owner_email: z.string().email(),
    owner_display_name: z.string().trim().min(1).max(120).optional(),
    tier: z.enum(["starter", "basic", "micro", "sme", "enterprise"]),
    post_promo_tier: z
      .enum(["starter", "basic", "micro", "sme", "enterprise"])
      .optional(),
    promo: z
      .object({
        tier: z.enum(["starter", "basic", "micro", "sme", "enterprise"]),
        months: z.number().int().min(1).max(24),
      })
      .optional(),
    campaign_code: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export type ProvisionClientInput = z.infer<typeof provisionSchema>;

export function parseProvisionClientInput(body: unknown): ProvisionClientInput {
  return provisionSchema.parse(body);
}

function slugifyBusiness(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function randomShort(): string {
  return Math.random().toString(36).slice(2, 8);
}

export interface ProvisionClientResult {
  businessId: string;
  idcompany: string;
  ownerEmail: string;
  effectiveTier: TierKey;
  promoEndsAt: string | null;
}

/**
 * Create business + invite owner. Optional promo tier for N months.
 */
export async function provisionClientAccount(
  svc: SupabaseClient,
  input: ProvisionClientInput,
  platformAdmin: { userId: string; email: string; platformAdminId?: string },
  requestOrigin: string | null,
): Promise<ProvisionClientResult> {
  const idcompany = `${slugifyBusiness(input.business_name)}-${randomShort()}`;
  const effectiveTier: TierKey = input.promo?.tier ?? input.tier;
  const initialCredits = tierBundledCredits(effectiveTier);

  const { data: businessRow, error: businessError } = await svc
    .from("businesses")
    .insert({
      idcompany,
      name: input.business_name,
      tier: input.tier,
      subscription_status: "active",
      subscription_renewal_at: freePlanRenewalAt(),
      brand_primary_hex: "#5B8C5A",
      brand_accent_hex: "#F4A340",
      credit_balance: 0,
    })
    .select("id, idcompany")
    .single();

  if (businessError || !businessRow) {
    throw new Error(businessError?.message ?? "Could not create business");
  }

  const businessId = businessRow.id as string;

  let promoEndsAt: string | null = null;
  if (input.promo) {
    promoEndsAt = new Date(
      Date.now() + input.promo.months * 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const postPromo = input.post_promo_tier ?? input.tier;
    const { error: promoError } = await svc.from("subscription_promotions").insert({
      business_id: businessId,
      promo_tier: input.promo.tier,
      post_promo_tier: postPromo,
      ends_at: promoEndsAt,
      campaign_code: input.campaign_code ?? null,
      granted_by: platformAdmin.platformAdminId ?? null,
      notes: input.notes ?? null,
    });
    if (promoError) {
      await svc.from("businesses").delete().eq("id", businessId);
      throw new Error(promoError.message);
    }
  }

  const redirectTo = authCallbackUrl("/accept-invite", requestOrigin);
  const { data: inviteData, error: inviteError } =
    await svc.auth.admin.inviteUserByEmail(input.owner_email, {
      redirectTo,
      data: {
        display_name: input.owner_display_name ?? input.owner_email,
        business_id: businessId,
        role: "owner",
      },
    });

  if (inviteError || !inviteData.user) {
    await svc.from("subscription_promotions").delete().eq("business_id", businessId);
    await svc.from("businesses").delete().eq("id", businessId);
    throw new Error(inviteError?.message ?? "Could not invite owner");
  }

  const authUserId = inviteData.user.id;

  const { error: profileError } = await svc.from("users").upsert({
    id: authUserId,
    business_id: businessId,
    role: "owner",
    display_name: input.owner_display_name ?? input.business_name,
    email: input.owner_email,
    last_password_change_at: new Date().toISOString(),
  });

  if (profileError) {
    await svc.auth.admin.deleteUser(authUserId);
    await svc.from("subscription_promotions").delete().eq("business_id", businessId);
    await svc.from("businesses").delete().eq("id", businessId);
    throw new Error(profileError.message);
  }

  await ensureMembership(authUserId, businessId, "owner", {
    email: input.owner_email,
    display_name: input.owner_display_name ?? input.business_name,
  });

  if (initialCredits > 0) {
    await grantTierBundledCredits(businessId, effectiveTier, platformAdmin.userId, svc);
  }

  await issueSubscriptionInvoice(svc, {
    businessId,
    userId: platformAdmin.userId,
    periodLabel: `${subscriptionPeriodLabel()} — provisioned`,
    amountMyr: 0,
  });

  await svc.from("super_admin_audit").insert({
    admin_user_id: platformAdmin.userId,
    admin_email: platformAdmin.email,
    action: "client.provision",
    target_type: "business",
    target_id: businessId,
    target_business_id: businessId,
    diff: {
      tier: input.tier,
      effective_tier: effectiveTier,
      promo: input.promo ?? null,
      campaign_code: input.campaign_code ?? null,
    },
  });

  return {
    businessId,
    idcompany: businessRow.idcompany as string,
    ownerEmail: input.owner_email,
    effectiveTier,
    promoEndsAt,
  };
}
