import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  renderBillingInvoicePdf,
  type BillingInvoiceRow,
} from "@/lib/settings/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();

  const [{ data: invoice, error: invoiceError }, { data: business, error: bizError }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, number, kind, period_label, amount_myr, tax_myr, status, paid_at, created_at, pdf_url",
        )
        .eq("id", id)
        .eq("business_id", user.businessId)
        .maybeSingle(),
      supabase
        .from("businesses")
        .select("name, registration_no, sst_number, contact_line, receipt_footer")
        .eq("id", user.businessId)
        .maybeSingle(),
    ]);

  if (invoiceError || bizError) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  if (!invoice || !business) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (invoice.pdf_url) {
    return NextResponse.redirect(invoice.pdf_url);
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await renderBillingInvoicePdf(
      invoice as BillingInvoiceRow,
      business,
    );
  } catch {
    return NextResponse.json({ error: "pdf_failed" }, { status: 500 });
  }

  const safeName = invoice.number.replace(/[^\w.-]+/g, "_");

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
