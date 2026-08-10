import { NextResponse } from "next/server";
import { requireFinanceUser } from "@/lib/finance/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadCustomerStatement } from "@/lib/finance/statement";
import { renderCustomerStatementPdf } from "@/lib/finance/statement-pdf";
import { loadBusiness } from "@/lib/settings/business";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const statement = await loadCustomerStatement(supabase, user.businessId, id);
  if (!statement) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Customer not found." } },
      { status: 404 },
    );
  }

  const business = await loadBusiness(user.businessId);
  if (!business) {
    return NextResponse.json(
      { ok: false, error: { code: "business_not_found", message: "Business not found." } },
      { status: 500 },
    );
  }

  const pdfBytes = await renderCustomerStatementPdf(statement, business);
  const filename = `statement-${statement.customer.name.replace(/[^\w-]+/g, "-")}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
