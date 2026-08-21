import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUsePos } from "@/lib/sales/access";
import { resolveProductImageUrls } from "@/lib/operations/product-image-urls";
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
      "id, sku, name, category, price_myr, is_active, stock_qty, low_stock_threshold, image_file_id",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json(
      { error: "load_failed" },
      { status: 500 },
    );
  }

  const rows = data ?? [];
  const imageUrls = await resolveProductImageUrls(
    supabase,
    rows.map((r) => r.image_file_id).filter(Boolean) as string[],
  );

  const enriched = rows.map((r) => ({
    ...r,
    image_url: r.image_file_id ? (imageUrls.get(r.image_file_id) ?? null) : null,
  }));

  return NextResponse.json({ data: enriched }, { status: 200 });
}
