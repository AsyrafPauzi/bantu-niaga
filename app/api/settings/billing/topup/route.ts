import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TOPUP_BUNDLES, topupSchema } from "@/lib/settings/schemas";
import {
  ensureBillplzPaymentMethod,
  isBillplzConfigured,
} from "@/lib/settings/billing";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/billing/topup — owner-only Fast Credits top-up.
 *
 * When Billplz env vars are set, this should create a Billplz bill and
 * return pending until the webhook marks the invoice paid.
 *
 * Until Billplz is wired up, we bypass the gateway and credit immediately
 * via settings_topup_credits (same RPC the webhook will call later).
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
  const billplzLive = isBillplzConfigured();

  let paymentMethodId = parsed.payment_method_id ?? null;
  if (!paymentMethodId) {
    try {
      paymentMethodId = await ensureBillplzPaymentMethod(
        supabase,
        user.businessId,
      );
    } catch (e) {
      return NextResponse.json(
        {
          error: "payment_method_failed",
          message:
            e instanceof Error
              ? e.message
              : "Could not prepare Billplz payment method.",
        },
        { status: 500 },
      );
    }
  }

  if (billplzLive) {
    // TODO: create Billplz bill, return checkout URL, keep invoice pending.
    return NextResponse.json(
      {
        error: "billplz_not_implemented",
        message:
          "Billplz checkout is not wired yet. Remove BILLPLZ_* env vars to use the development bypass.",
      },
      { status: 501 },
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
  const invoiceId = row?.invoice_id ?? null;

  let invoiceNumber: string | null = null;
  if (invoiceId) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("number")
      .eq("id", invoiceId)
      .maybeSingle();
    invoiceNumber = inv?.number ?? null;
  }

  return NextResponse.json(
    {
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      new_balance: row?.new_balance ?? null,
      credits_added: bundle.credits,
      amount_myr: bundle.amount_myr,
      bypass: true,
    },
    { status: 201 },
  );
}
