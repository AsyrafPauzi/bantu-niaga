import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { nextSaleNumber, postPosSaleToFinance } from "@/lib/sales/checkout";
import { canUsePos } from "@/lib/sales/access";
import { computePosTotals, posCheckoutSchema } from "@/lib/sales/schemas";
import { loadBusiness } from "@/lib/settings/business";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/sales/pos/checkout — complete a paid-in-full POS sale.
 * Posts income into Finance. Core payments: cash | duitnow_qr_static.
 */
export async function POST(request: Request) {
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
    return NextResponse.json(
      { error: "forbidden", message: "You cannot complete POS sales." },
      { status: 403 },
    );
  }

  // sales_rep has pos:r only
  if (user.role === "sales_rep") {
    return NextResponse.json(
      { error: "forbidden", message: "You cannot complete POS sales." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = posCheckoutSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const business = await loadBusiness(user.businessId);
  if (!business) {
    return NextResponse.json({ error: "business_not_found" }, { status: 404 });
  }

  if (
    parsed.payment_method === "duitnow_qr_static" &&
    !business.duitnow_qr_url &&
    !business.duitnow_id
  ) {
    return NextResponse.json(
      {
        error: "duitnow_not_configured",
        message:
          "Set your static DuitNow QR or ID in Settings → Branding before taking DuitNow payments.",
      },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const productIds = parsed.items.map((i) => i.product_id);
  const { data: products, error: prodErr } = await supabase
    .from("operations_products")
    .select("id, sku, name, price_myr, is_active, deleted_at")
    .eq("business_id", user.businessId)
    .in("id", productIds);

  if (prodErr) {
    return NextResponse.json(
      { error: "product_lookup_failed", message: prodErr.message },
      { status: 500 },
    );
  }

  const byId = new Map((products ?? []).map((p) => [p.id as string, p]));
  const lines: Array<{
    product_id: string;
    product_name: string;
    product_sku: string | null;
    unit_price_myr: number;
    quantity: number;
    line_total_myr: number;
    sort_order: number;
  }> = [];

  let lineSubtotal = 0;
  let sort = 0;
  for (const item of parsed.items) {
    const p = byId.get(item.product_id);
    if (!p || p.deleted_at || !p.is_active) {
      return NextResponse.json(
        {
          error: "product_unavailable",
          message: "One or more products are missing or inactive.",
        },
        { status: 400 },
      );
    }
    const unit = Number(p.price_myr ?? 0);
    const qty = item.quantity;
    const lineTotal = Number((unit * qty).toFixed(2));
    lineSubtotal += lineTotal;
    lines.push({
      product_id: p.id as string,
      product_name: String(p.name),
      product_sku: (p.sku as string | null) ?? null,
      unit_price_myr: unit,
      quantity: qty,
      line_total_myr: lineTotal,
      sort_order: sort++,
    });
  }

  const totals = computePosTotals({
    lineSubtotal,
    discountType: parsed.discount_type,
    discountValue: parsed.discount_value,
    sstEnabled: business.sst_enabled,
    sstRatePct: Number(business.sst_rate_pct ?? 0),
  });

  let change = 0;
  let paymentReceived = totals.total_myr;
  if (parsed.payment_method === "cash") {
    paymentReceived =
      parsed.payment_received_myr != null
        ? parsed.payment_received_myr
        : totals.total_myr;
    if (paymentReceived + 0.001 < totals.total_myr) {
      return NextResponse.json(
        {
          error: "insufficient_payment",
          message: "Cash received is less than the total.",
        },
        { status: 400 },
      );
    }
    change = Number((paymentReceived - totals.total_myr).toFixed(2));
  }

  if (parsed.customer_id) {
    const { data: cust } = await supabase
      .from("customers")
      .select("id, name")
      .eq("business_id", user.businessId)
      .eq("id", parsed.customer_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!cust) {
      return NextResponse.json(
        { error: "customer_not_found" },
        { status: 400 },
      );
    }
  }

  const saleNumber = await nextSaleNumber(supabase, user.businessId);

  const { data: sale, error: saleErr } = await supabase
    .from("pos_sales")
    .insert({
      business_id: user.businessId,
      sale_number: saleNumber,
      cashier_user_id: user.id,
      customer_id: parsed.customer_id ?? null,
      customer_name: parsed.customer_name ?? null,
      subtotal_myr: totals.subtotal_myr,
      discount_type: parsed.discount_type ?? null,
      discount_value: parsed.discount_value ?? null,
      discount_amount_myr: totals.discount_amount_myr,
      sst_amount_myr: totals.sst_amount_myr,
      total_myr: totals.total_myr,
      payment_method: parsed.payment_method,
      payment_received_myr: paymentReceived,
      change_myr: change,
      payment_note: parsed.payment_note ?? null,
      status: "completed",
    })
    .select(
      "id, sale_number, subtotal_myr, discount_amount_myr, sst_amount_myr, total_myr, payment_method, payment_received_myr, change_myr, customer_name, created_at",
    )
    .single();

  if (saleErr || !sale) {
    logger.error("sales.pos.checkout.insert_failed", {
      businessId: user.businessId,
      error: saleErr?.message,
    });
    return NextResponse.json(
      { error: "insert_failed", message: saleErr?.message ?? "sale failed" },
      { status: 500 },
    );
  }

  const itemRows = lines.map((l) => ({
    business_id: user.businessId,
    sale_id: sale.id,
    ...l,
  }));

  const { error: itemsErr } = await supabase
    .from("pos_sale_items")
    .insert(itemRows);

  if (itemsErr) {
    logger.error("sales.pos.checkout.items_failed", {
      businessId: user.businessId,
      saleId: sale.id,
      error: itemsErr.message,
    });
    // Best-effort cleanup
    await supabase
      .from("pos_sales")
      .delete()
      .eq("id", sale.id)
      .eq("business_id", user.businessId);
    return NextResponse.json(
      { error: "items_failed", message: itemsErr.message },
      { status: 500 },
    );
  }

  let financeTransactionId: string | null = null;
  try {
    financeTransactionId = await postPosSaleToFinance({
      supabase,
      businessId: user.businessId,
      userId: user.id,
      saleId: sale.id as string,
      saleNumber,
      totalMyr: totals.total_myr,
      paymentMethod: parsed.payment_method,
      customerName: parsed.customer_name ?? null,
    });
  } catch (err) {
    logger.error("sales.pos.checkout.finance_failed", {
      businessId: user.businessId,
      saleId: sale.id,
      error: err instanceof Error ? err.message : String(err),
    });
    // Sale is kept; surface warning so cashier knows Finance needs attention
    return NextResponse.json(
      {
        data: {
          sale,
          items: lines,
          finance_transaction_id: null,
          finance_warning:
            "Sale saved but Finance income failed. Check Finance → Transactions.",
        },
      },
      { status: 201 },
    );
  }

  return NextResponse.json(
    {
      data: {
        sale,
        items: lines,
        finance_transaction_id: financeTransactionId,
      },
    },
    { status: 201 },
  );
}
