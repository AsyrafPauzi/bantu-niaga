import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchSaleVoided } from "@/lib/events/dispatch-sale";
import type { SaleVoidedPayload } from "@/lib/events/sale-payloads";

export async function voidPosSale(opts: {
  supabase: SupabaseClient;
  businessId: string;
  userId: string;
  saleId: string;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: sale, error: saleErr } = await opts.supabase
    .from("pos_sales")
    .select(
      "id, sale_number, status, finance_transaction_id, business_id, payment_method",
    )
    .eq("id", opts.saleId)
    .eq("business_id", opts.businessId)
    .maybeSingle();

  if (saleErr || !sale) {
    return { ok: false, error: "sale_not_found" };
  }
  if (sale.status === "voided") {
    return { ok: false, error: "already_voided" };
  }

  const { data: items } = await opts.supabase
    .from("pos_sale_items")
    .select("product_id, quantity")
    .eq("sale_id", opts.saleId)
    .eq("business_id", opts.businessId);

  const now = new Date().toISOString();

  const { error: voidErr } = await opts.supabase
    .from("pos_sales")
    .update({
      status: "voided",
      voided_at: now,
      voided_by: opts.userId,
      void_reason: opts.reason?.trim() || null,
    })
    .eq("id", opts.saleId)
    .eq("business_id", opts.businessId)
    .eq("status", "completed");

  if (voidErr) {
    return { ok: false, error: voidErr.message };
  }

  const payload: SaleVoidedPayload = {
    sale_id: opts.saleId,
    sale_number: sale.sale_number,
    business_id: opts.businessId,
    voided_by_user_id: opts.userId,
    voided_at: now,
    finance_transaction_id: sale.finance_transaction_id,
    line_items: (items ?? []).map((i) => ({
      product_id: i.product_id,
      quantity: Number(i.quantity),
    })),
  };

  try {
    await dispatchSaleVoided({
      supabase: opts.supabase,
      payload,
      userId: opts.userId,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "void_dispatch_failed",
    };
  }

  return { ok: true };
}
