import { NextResponse } from "next/server";
import { verifyBillplzSignature } from "@/lib/integrations/billplz";
import { logger } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/webhooks/billplz — Billplz payment callback. */
export async function POST(request: Request) {
  const signatureKey = process.env.BILLPLZ_X_SIGNATURE_KEY?.trim();
  if (!signatureKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const text = await request.text();
  const form = new URLSearchParams(text);
  const payload: Record<string, string> = {};
  form.forEach((value, key) => {
    payload[key] = value;
  });

  if (!verifyBillplzSignature(payload, signatureKey)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  if (payload.paid !== "true" || !payload.id) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("settings_complete_topup_billplz", {
    p_billplz_id: payload.id,
  });

  if (error) {
    logger.error("billplz.webhook.complete_failed", {
      billId: payload.id,
      error: error.message,
    });
    return NextResponse.json({ error: "complete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
