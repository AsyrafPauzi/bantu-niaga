import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tierChangeSchema } from "@/lib/settings/schemas";
import { isBillplzConfigured } from "@/lib/settings/billing";
import {
  BillplzNotConfiguredError,
  assertBillplzConfiguredForPaidCheckout,
} from "@/lib/settings/require-billplz-prod";
import { tierAmountMyr } from "@/lib/settings/subscription-billing";
import { startSubscriptionCheckout } from "@/lib/settings/subscription-checkout";
import { tierBy, type TierKey } from "@/lib/settings/plans";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/subscription/change — owner-only tier switch.
 *
 * RM0 (Free) applies instantly via settings_change_tier.
 * Paid tiers create a Billplz checkout; webhook applies the tier.
 * Non-production without Billplz keeps the instant apply bypass for local demos.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "forbidden", reason: "Only the owner can change the plan." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = tierChangeSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const tier = parsed.tier as TierKey;
  const cadence = (parsed.cadence ?? "monthly") as "monthly" | "annual";

  const tierDef = tierBy(tier);
  let amount: number;
  if (cadence === "annual") {
    if (!tierDef?.annualPriceMyr) {
      return NextResponse.json(
        { error: "annual_not_available", message: "Annual billing is not available for this tier." },
        { status: 400 },
      );
    }
    amount = tierDef.annualPriceMyr;
  } else {
    amount = tierAmountMyr(tier);
  }

  const supabase = await createSupabaseServerClient();

  if (amount > 0) {
    try {
      assertBillplzConfiguredForPaidCheckout();
    } catch (e) {
      if (e instanceof BillplzNotConfiguredError) {
        return NextResponse.json(
          {
            error: e.code,
            message: "Payment is not available.",
          },
          { status: 503 },
        );
      }
      throw e;
    }

    if (isBillplzConfigured()) {
      const { data: profile } = await supabase
        .from("users")
        .select("email, display_name")
        .eq("id", user.id)
        .maybeSingle();

      try {
        const checkout = await startSubscriptionCheckout({
          supabase,
          businessId: user.businessId,
          userId: user.id,
          pendingTier: tier,
          amountMyr: amount,
          payerEmail: profile?.email ?? "owner@business.local",
          payerName: profile?.display_name ?? "Business owner",
          cadence,
        });
        return NextResponse.json(checkout, { status: 201 });
      } catch (e) {
        if (e instanceof BillplzNotConfiguredError) {
          return NextResponse.json(
            { error: e.code, message: "Payment is not available." },
            { status: 503 },
          );
        }
        return NextResponse.json(
          {
            error: "billplz_create_failed",
            message:
              e instanceof Error ? e.message : "Billplz checkout failed",
          },
          { status: 502 },
        );
      }
    }
    // Non-production without Billplz: fall through to instant apply.
  }

  const { error: rpcError } = await supabase.rpc("settings_change_tier", {
    p_business_id: user.businessId,
    p_tier: tier,
    p_user_id: user.id,
  });

  if (rpcError) {
    return NextResponse.json(
      { error: "change_failed", message: rpcError.message },
      { status: 500 },
    );
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("tier, subscription_status, subscription_renewal_at")
    .eq("id", user.businessId)
    .maybeSingle();

  return NextResponse.json(
    {
      tier: business?.tier ?? tier,
      subscription_status: business?.subscription_status ?? "active",
      subscription_renewal_at: business?.subscription_renewal_at ?? null,
      pending: false,
    },
    { status: 200 },
  );
}
