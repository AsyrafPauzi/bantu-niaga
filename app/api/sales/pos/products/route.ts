import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUsePos } from "@/lib/sales/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/sales/pos/products — active Operations catalog for POS grid. */
export async function GET() {
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

  if (!canUsePos(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operations_products")
    .select(
      "id, sku, name, category, price_myr, is_active",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json(
      { error: "load_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}
