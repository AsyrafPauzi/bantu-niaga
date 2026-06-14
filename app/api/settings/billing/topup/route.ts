import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TOPUP_BUNDLES, topupSchema } from "@/lib/settings/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/billing/topup — owner-only Fast Credits top-up.
 *
 * Stub gateway: we mark the invoice as paid immediately. In production
 * this routes through Billplz / Curlec; their webhook flips the status
 * from 'pending' to 'paid' and triggers the credit_ledger insert via
 * the same RPC.
 *
 * The RPC writes invoice + ledger + business balance + audit log in one
 * Postgres transaction.
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
      { error: "forbidden", reason: "Only the owner can top up." },
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
    parsed = topupSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const bundle = TOPUP_BUNDLES[parsed.bundle];
  const supabase = await createSupabaseServerClient();

  // Resolve a payment method: the one the user picked, or the default.
  let paymentMethodId = parsed.payment_method_id ?? null;
  if (!paymentMethodId) {
    const { data } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("business_id", user.businessId)
      .eq("is_default", true)
      .maybeSingle();
    paymentMethodId = data?.id ?? null;
  }
  if (!paymentMethodId) {
    return NextResponse.json(
      {
        error: "no_payment_method",
        message:
          "Add a payment method before topping up Fast Credits.",
      },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("settings_topup_credits", {
    p_business_id: user.businessId,
    p_credits: bundle.credits,
    p_amount_myr: bundle.amount_myr,
    p_payment_method_id: paymentMethodId,
    p_user_id: user.id,
  });

  if (error) {
    return NextResponse.json(
      { error: "topup_failed", message: error.message },
      { status: 500 },
    );
  }

  const row = Array.isArray(data) ? data[0] : data;

  return NextResponse.json(
    {
      invoice_id: row?.invoice_id ?? null,
      new_balance: row?.new_balance ?? null,
      credits_added: bundle.credits,
      amount_myr: bundle.amount_myr,
    },
    { status: 201 },
  );
}
