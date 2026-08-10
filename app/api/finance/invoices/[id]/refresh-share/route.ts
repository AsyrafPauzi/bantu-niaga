import { NextResponse } from "next/server";
import { requireFinanceUser } from "@/lib/finance/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { INVOICE_SELECT } from "@/lib/finance/invoice-db";
import { buildInvoiceShareFields } from "@/lib/finance/share-link";
import type { FinanceInvoiceRow } from "@/lib/finance/schemas";

export const dynamic = "force-dynamic";

/** POST — regenerate public share link (3-day TTL for unpaid invoices). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("finance_invoices")
    .select(INVOICE_SELECT)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Invoice not found." } },
      { status: 404 },
    );
  }

  const invoice = existing as unknown as FinanceInvoiceRow;
  if (invoice.status === "void") {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_status", message: "Cannot refresh a void invoice." } },
      { status: 400 },
    );
  }

  const shareFields = buildInvoiceShareFields(invoice.status);
  const { data, error } = await supabase
    .from("finance_invoices")
    .update({
      share_hash: shareFields.share_hash,
      share_issued_at: shareFields.share_issued_at,
      share_expires_at: shareFields.share_expires_at,
    })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .select(INVOICE_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "update_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data }, { status: 200 });
}
