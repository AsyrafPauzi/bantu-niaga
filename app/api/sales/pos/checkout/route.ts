import { enforceRateLimit } from "@/lib/api/enforce-rate-limit";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { validateCoupon, redeemCoupon } from "@/lib/marketing/coupons";
import { dispatchSaleCompleted } from "@/lib/events/dispatch-sale";
import type { SaleCompletedPayload } from "@/lib/events/sale-payloads";
import { nextSaleNumber } from "@/lib/sales/checkout";
import { canUsePos } from "@/lib/sales/access";
import { computePosTotals, posCheckoutSchema } from "@/lib/sales/schemas";
import { loadBusiness } from "@/lib/settings/business";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { notifySalesPosCompleted } from "@/lib/sales/notify";
import {
  assertBusinessSubscriptionWritable,
  SubscriptionPastDueError,
} from "@/lib/settings/assert-business-writable";
import { pastDueJsonResponse } from "@/lib/settings/past-due-response";
import { touchActivation } from "@/lib/settings/activation";

export const dynamic = "force-dynamic";

type SaleLine = {
  product_id: string | null;
  service_id: string | null;
  product_name: string;
  product_sku: string | null;
  unit_price_myr: number;
  quantity: number;
  line_total_myr: number;
  sort_order: number;
};

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

  const supabase = await createSupabaseServerClient();
  try {
    await assertBusinessSubscriptionWritable(supabase, user.businessId);
  } catch (e) {
    if (e instanceof SubscriptionPastDueError) {
      return pastDueJsonResponse(e);
    }
    throw e;
  }

  const limited = enforceRateLimit({
    bucket: "sales.pos.checkout",
    identifier: `user:${user.id}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

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

  const productIds = parsed.items
    .filter((i) => i.product_id)
    .map((i) => i.product_id as string);
  const serviceIds = parsed.items
    .filter((i) => i.service_id)
    .map((i) => i.service_id as string);

  const [productsRes, servicesRes] = await Promise.all([
    productIds.length > 0
      ? supabase
          .from("operations_products")
          .select("id, sku, name, price_myr, is_active, deleted_at, stock_qty")
          .eq("business_id", user.businessId)
          .in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length > 0
      ? supabase
          .from("operations_services")
          .select("id, name, price_myr, is_active, deleted_at")
          .eq("business_id", user.businessId)
          .in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productsRes.error) {
    return NextResponse.json(
      { error: "product_lookup_failed", message: productsRes.error.message },
      { status: 500 },
    );
  }
  if (servicesRes.error) {
    return NextResponse.json(
      { error: "service_lookup_failed", message: servicesRes.error.message },
      { status: 500 },
    );
  }

  const productsById = new Map(
    (productsRes.data ?? []).map((p) => [p.id as string, p]),
  );
  const servicesById = new Map(
    (servicesRes.data ?? []).map((s) => [s.id as string, s]),
  );

  const lines: SaleLine[] = [];
  let lineSubtotal = 0;
  let sort = 0;

  for (const item of parsed.items) {
    if (item.product_id) {
      const p = productsById.get(item.product_id);
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
        service_id: null,
        product_name: String(p.name),
        product_sku: (p.sku as string | null) ?? null,
        unit_price_myr: unit,
        quantity: qty,
        line_total_myr: lineTotal,
        sort_order: sort++,
      });
    } else if (item.service_id) {
      const s = servicesById.get(item.service_id);
      if (!s || s.deleted_at || !s.is_active) {
        return NextResponse.json(
          {
            error: "service_unavailable",
            message: "One or more services are missing or inactive.",
          },
          { status: 400 },
        );
      }
      const unit = Number(s.price_myr ?? 0);
      const qty = item.quantity;
      const lineTotal = Number((unit * qty).toFixed(2));
      lineSubtotal += lineTotal;
      lines.push({
        product_id: null,
        service_id: s.id as string,
        product_name: String(s.name),
        product_sku: null,
        unit_price_myr: unit,
        quantity: qty,
        line_total_myr: lineTotal,
        sort_order: sort++,
      });
    }
  }

  let discountType = parsed.discount_type;
  let discountValue = parsed.discount_value;
  let couponId: string | null = null;
  let couponCode: string | null = null;

  if (parsed.coupon_code) {
    const couponResult = await validateCoupon({
      supabase,
      businessId: user.businessId,
      code: parsed.coupon_code,
      customerId: parsed.customer_id ?? null,
      subtotalMyr: lineSubtotal,
    });
    if (!couponResult.ok) {
      return NextResponse.json(
        { error: "coupon_invalid", reason: couponResult.reason },
        { status: 400 },
      );
    }
    discountType = "amount";
    discountValue = couponResult.discount_myr;
    couponId = couponResult.coupon.id;
    couponCode = couponResult.coupon.code;
  }

  const totals = computePosTotals({
    lineSubtotal,
    discountType,
    discountValue,
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

  let resolvedCustomerName = parsed.customer_name ?? null;
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
    if (!resolvedCustomerName) resolvedCustomerName = cust.name;
  }

  const saleNumber = await nextSaleNumber(supabase, user.businessId);

  const { data: sale, error: saleErr } = await supabase
    .from("pos_sales")
    .insert({
      business_id: user.businessId,
      sale_number: saleNumber,
      cashier_user_id: user.id,
      customer_id: parsed.customer_id ?? null,
      customer_name: resolvedCustomerName,
      subtotal_myr: totals.subtotal_myr,
      discount_type: discountType ?? null,
      discount_value: discountValue ?? null,
      discount_amount_myr: totals.discount_amount_myr,
      sst_amount_myr: totals.sst_amount_myr,
      total_myr: totals.total_myr,
      payment_method: parsed.payment_method,
      payment_received_myr: paymentReceived,
      change_myr: change,
      payment_note: parsed.payment_note ?? null,
      coupon_id: couponId,
      coupon_code: couponCode,
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
    product_id: l.product_id,
    service_id: l.service_id,
    product_name: l.product_name,
    product_sku: l.product_sku,
    unit_price_myr: l.unit_price_myr,
    quantity: l.quantity,
    line_total_myr: l.line_total_myr,
    sort_order: l.sort_order,
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

  if (couponCode) {
    try {
      await redeemCoupon({
        serviceClient: supabase,
        businessId: user.businessId,
        code: couponCode,
        customerId: parsed.customer_id ?? null,
        orderRef: saleNumber,
        subtotalMyr: lineSubtotal,
        redeemedBy: user.id,
      });
    } catch (couponErr) {
      logger.warn("sales.pos.checkout.coupon_redeem_failed", {
        businessId: user.businessId,
        saleId: sale.id,
        error:
          couponErr instanceof Error ? couponErr.message : String(couponErr),
      });
    }
  }

  const eventPayload: SaleCompletedPayload = {
    sale_id: sale.id as string,
    sale_number: saleNumber,
    business_id: user.businessId,
    cashier_user_id: user.id,
    customer_id: parsed.customer_id ?? null,
    customer_name: resolvedCustomerName,
    total_myr: totals.total_myr,
    payment_method: parsed.payment_method,
    completed_at: sale.created_at as string,
    line_items: lines.map((l) => ({
      product_id: l.product_id,
      service_id: l.service_id,
      product_name: l.product_name,
      quantity: l.quantity,
      line_total_myr: l.line_total_myr,
    })),
  };

  let financeTransactionId: string | null = null;
  try {
    const dispatched = await dispatchSaleCompleted({
      supabase,
      payload: eventPayload,
      userId: user.id,
    });
    financeTransactionId = dispatched.finance_transaction_id;
  } catch (err) {
    const isStock =
      err instanceof Error && /insufficient stock/i.test(err.message);
    logger.error("sales.pos.checkout.event_failed", {
      businessId: user.businessId,
      saleId: sale.id,
      error: err instanceof Error ? err.message : String(err),
    });
    if (isStock) {
      await supabase.from("pos_sale_items").delete().eq("sale_id", sale.id);
      await supabase
        .from("pos_sales")
        .delete()
        .eq("id", sale.id)
        .eq("business_id", user.businessId);
      return NextResponse.json(
        {
          error: "insufficient_stock",
          message:
            "One or more items in this sale don't have enough stock. " +
            "Please adjust the quantities and try again.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        data: {
          sale,
          items: lines,
          finance_transaction_id: null,
          finance_warning:
            "Sale saved but cross-pillar sync failed. Check Finance → Transactions.",
        },
      },
      { status: 201 },
    );
  }

  notifySalesPosCompleted({
    businessId: user.businessId,
    saleId: sale.id,
    saleNumber: sale.sale_number as string,
    totalMyr: Number(sale.total_myr),
    paymentMethod: sale.payment_method as string,
  });

  await touchActivation(supabase, user.businessId, "pos");

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
