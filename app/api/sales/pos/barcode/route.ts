import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUsePos } from "@/lib/sales/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/sales/pos/barcode?code=<barcode>
 * Look up an active product by barcode for POS scanner.
 * Returns the matched product or 404 — never exposes other business data.
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

  if (!canUsePos(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();

  if (!code) {
    return NextResponse.json(
      { error: "missing_code", message: "Barcode value is required." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operations_products")
    .select("id, sku, name, category, price_myr, stock_qty, low_stock_threshold, image_file_id")
    .eq("business_id", user.businessId)
    .eq("barcode", code)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "not_found", message: `No active product found for barcode: ${code}` },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { data: { ...data, price_myr: Number(data.price_myr) } },
    { status: 200 },
  );
}
