import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createBillplzBill, billplzCallbackUrl } from "@/lib/integrations/billplz";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TOPUP_BUNDLES, topupSchema } from "@/lib/settings/schemas";
import { CREDIT_TOPUP_BY_SLUG } from "@/lib/marketplace/credit-topup-purchase";
import {
  ensureBillplzPaymentMethod,
  isBillplzConfigured,
} from "@/lib/settings/billing";
import {
  assertBusinessSubscriptionWritable,
  SubscriptionPastDueError,
} from "@/lib/settings/assert-business-writable";
import { pastDueJsonResponse } from "@/lib/settings/past-due-response";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/billing/topup — owner-only Fast Credits top-up.
 *
 * When Billplz env vars are set, creates a Billplz bill and returns checkout URL.
 * Webhook completes credits via settings_complete_topup_billplz.
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

  const supabaseEarly = await createSupabaseServerClient();
  try {
    await assertBusinessSubscriptionWritable(
      supabaseEarly,
      user.businessId,
    );
  } catch (e) {
    if (e instanceof SubscriptionPastDueError) {
      return pastDueJsonResponse(e);
    }
    throw e;
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

  const credits =
    "addon_slug" in parsed
      ? CREDIT_TOPUP_BY_SLUG[parsed.addon_slug].credits
      : TOPUP_BUNDLES[parsed.bundle].credits;
  const amountMyr =
    "addon_slug" in parsed
      ? CREDIT_TOPUP_BY_SLUG[parsed.addon_slug].amount_myr
      : TOPUP_BUNDLES[parsed.bundle].amount_myr;

  const supabase = supabaseEarly;
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
    const collectionId = process.env.BILLPLZ_COLLECTION_ID!.trim();
    const amountCents = Math.round(amountMyr * 100);

    const { data: profile } = await supabase
      .from("users")
      .select("email, display_name")
      .eq("id", user.id)
      .maybeSingle();

    const payerEmail = profile?.email ?? "owner@business.local";
    const payerName = profile?.display_name ?? "Business owner";

    try {
      const bill = await createBillplzBill({
        collectionId,
        email: payerEmail,
        name: payerName,
        amountCents,
        description: `NiagaX Fast Credits — ${credits} credits`,
        callbackUrl: billplzCallbackUrl(),
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")}/settings/billing?topup=success`,
        reference1: user.businessId,
        reference2: String(credits),
      });

      const { data: pending, error: pendingErr } = await supabase.rpc(
        "settings_create_topup_pending",
        {
          p_business_id: user.businessId,
          p_credits: credits,
          p_amount_myr: amountMyr,
          p_payment_method_id: paymentMethodId,
          p_user_id: user.id,
          p_billplz_id: bill.id,
          p_billplz_url: bill.url,
        },
      );

      if (pendingErr || !pending) {
        return NextResponse.json(
          {
            error: "topup_pending_failed",
            message: pendingErr?.message ?? "Could not create pending invoice",
          },
          { status: 500 },
        );
      }

      const row = Array.isArray(pending) ? pending[0] : pending;

      return NextResponse.json(
        {
          checkout_url: bill.url,
          billplz_id: bill.id,
          invoice_id: row?.invoice_id ?? null,
          intent_id: row?.intent_id ?? null,
          credits,
          amount_myr: amountMyr,
          pending: true,
        },
        { status: 201 },
      );
    } catch (e) {
      return NextResponse.json(
        {
          error: "billplz_create_failed",
          message: e instanceof Error ? e.message : "Billplz checkout failed",
        },
        { status: 502 },
      );
    }
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: "billplz_not_configured",
        message: "Payment is not available.",
      },
      { status: 503 },
    );
  }

  const { data, error } = await supabase.rpc("settings_topup_credits", {
    p_business_id: user.businessId,
    p_credits: credits,
    p_amount_myr: amountMyr,
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
      credits_added: credits,
      amount_myr: amountMyr,
      bypass: true,
    },
    { status: 201 },
  );
}
