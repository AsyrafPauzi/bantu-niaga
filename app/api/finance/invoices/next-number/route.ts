import { NextResponse } from "next/server";
import { requireFinanceUser } from "@/lib/finance/require-user";
import { nextFinanceInvoiceNumber } from "@/lib/finance/helpers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix") === "QUO" ? "QUO" : "INV";

  // Service role matches create/convert paths so preview and save share one sequence.
  const admin = createServiceRoleClient();
  const number = await nextFinanceInvoiceNumber(
    admin,
    auth.user.businessId,
    prefix,
  );

  return NextResponse.json({ number }, { status: 200 });
}
