import { NextResponse } from "next/server";
import { requireFinanceUser } from "@/lib/finance/require-user";
import { nextFinanceInvoiceNumber } from "@/lib/finance/helpers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix") === "QUO" ? "QUO" : "INV";

  const supabase = await createSupabaseServerClient();
  const number = await nextFinanceInvoiceNumber(supabase, auth.user.businessId, prefix);

  return NextResponse.json({ number }, { status: 200 });
}
