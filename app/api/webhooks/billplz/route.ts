import { NextResponse } from "next/server";
import { completeBillplzPayment } from "@/lib/finance/billplz-checkout";
import { dispatchInvoicePaid } from "@/lib/finance/dispatch-invoice-paid";
import { loadInvoiceWithItems } from "@/lib/finance/invoice-db";
import { notifyFinanceBillplzPaid } from "@/lib/finance/notify";
import { verifyBillplzSignature } from "@/lib/integrations/billplz";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/webhooks/billplz — Billplz payment callback (finance invoices + top-ups). */
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

  try {
    const result = await completeBillplzPayment(payload.id);
    if (result.kind === "finance") {
      const admin = createServiceRoleClient();
      const invoice = await loadInvoiceWithItems(
        admin,
        result.businessId,
        result.invoiceId,
      );
      if (invoice) {
        await dispatchInvoicePaid({
          supabase: admin,
          invoice,
          userId: invoice.created_by ?? null,
          paymentMethod: "fpx",
        });
      }
      await notifyFinanceBillplzPaid(
        admin,
        result.businessId,
        result.invoiceId,
      );
    }
    return NextResponse.json({ ok: true, kind: result.kind });
  } catch (e) {
    logger.error("billplz.webhook.complete_failed", {
      billId: payload.id,
      error: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json({ error: "complete_failed" }, { status: 500 });
  }
}
