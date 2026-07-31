import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { restoreProductStock, type StockLine } from "@/lib/sales/stock";

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
      "id, sale_number, status, finance_transaction_id, business_id",
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

  const stockLines: StockLine[] = (items ?? [])
    .filter((i) => i.product_id)
    .map((i) => ({
      product_id: i.product_id as string,
      quantity: Number(i.quantity),
    }));

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

  if (sale.finance_transaction_id) {
    await opts.supabase
      .from("finance_transactions")
      .update({ deleted_at: now })
      .eq("id", sale.finance_transaction_id)
      .eq("business_id", opts.businessId);
  }

  if (stockLines.length > 0) {
    await restoreProductStock(opts.supabase, opts.businessId, stockLines);
  }

  return { ok: true };
}
