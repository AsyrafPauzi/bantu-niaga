import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOperationsUser } from "@/lib/operations/require-user";
import { searchCustomers } from "@/lib/customers/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireOperationsUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q) {
    return NextResponse.json({ ok: true, data: [] });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const results = await searchCustomers(supabase, {
      businessId: user.businessId,
      query: q,
      limit: 10,
    });
    return NextResponse.json({ ok: true, data: results });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "search_failed", message: "Search failed." } },
      { status: 500 },
    );
  }
}
