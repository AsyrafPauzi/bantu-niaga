import { NextResponse } from "next/server";
import { z } from "zod";
import { createFinanceInvoiceBillplzCheckout } from "@/lib/finance/billplz-checkout";
import { loadPublicFinanceInvoice } from "@/lib/finance/public-invoice";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    idcompany: z.string().trim().min(1).max(80),
    share_hash: z.string().trim().min(6).max(80),
  })
  .strict();

/**
 * POST /api/finance/invoices/public/checkout
 * Public Billplz checkout for a shared invoice. Key-gated via BILLPLZ_* env vars.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_json", message: "Invalid JSON." } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "validation_failed", message: "Invalid request." } },
      { status: 400 },
    );
  }

  const invoice = await loadPublicFinanceInvoice(
    parsed.data.idcompany,
    parsed.data.share_hash,
  );

  if (!invoice) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Invoice not found." } },
      { status: 404 },
    );
  }

  try {
    const result = await createFinanceInvoiceBillplzCheckout(
      invoice,
      parsed.data.idcompany,
    );

    if (!result.configured) {
      return NextResponse.json(
        {
          ok: false,
          configured: false,
          error: {
            code: "billplz_not_configured",
            message: result.message,
          },
        },
        { status: 503 },
      );
    }

    if (!result.checkout_url) {
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          error: {
            code: "checkout_unavailable",
            message: result.message ?? "Checkout unavailable.",
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        configured: true,
        data: {
          checkout_url: result.checkout_url,
          billplz_id: result.billplz_id,
          pending: result.pending ?? true,
        },
      },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "billplz_create_failed",
          message: e instanceof Error ? e.message : "Checkout failed.",
        },
      },
      { status: 502 },
    );
  }
}
