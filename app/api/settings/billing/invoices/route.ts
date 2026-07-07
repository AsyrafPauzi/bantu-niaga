import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/billing/invoices — paginated list of tax invoices.
 *
 * Query:
 *   - page (default 1)
 *   - pageSize (default 10, max 100)
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? 10)),
  );

  const supabase = await createSupabaseServerClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("invoices")
    .select(
      "id, number, kind, period_label, amount_myr, tax_myr, status, paid_at, pdf_url, created_at",
      { count: "exact" },
    )
    .eq("business_id", user.businessId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json(
      { error: "list_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      data: data ?? [],
      page,
      pageSize,
      total: count ?? 0,
    },
    { status: 200 },
  );
}
