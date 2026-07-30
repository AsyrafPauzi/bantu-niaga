import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { loadLastInvoiceForCustomer } from "@/lib/finance/invoice-composer-context";
import { FINANCE_DOCUMENT_KINDS } from "@/lib/finance/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/finance/invoices/last-for-customer?customer_id=&kind=invoice|quote */
export async function GET(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: "unauthorized", message: "Sign in required." } },
        { status: 401 },
      );
    }
    throw e;
  }

  if (!can(user.role, "finance")) {
    return NextResponse.json(
      { ok: false, error: { code: "forbidden", message: "Finance access denied." } },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customer_id")?.trim();
  if (!customerId) {
    return NextResponse.json(
      { ok: false, error: { code: "validation_failed", message: "customer_id required." } },
      { status: 400 },
    );
  }

  const kindParam = url.searchParams.get("kind");
  const documentKind = FINANCE_DOCUMENT_KINDS.includes(
    kindParam as (typeof FINANCE_DOCUMENT_KINDS)[number],
  )
    ? (kindParam as (typeof FINANCE_DOCUMENT_KINDS)[number])
    : undefined;

  const supabase = await createSupabaseServerClient();
  const invoice = await loadLastInvoiceForCustomer(
    supabase,
    user.businessId,
    customerId,
    documentKind,
  );

  return NextResponse.json({ ok: true, data: invoice }, { status: 200 });
}
