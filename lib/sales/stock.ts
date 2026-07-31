import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type StockLine = { product_id: string; quantity: number };

/** Decrement tracked stock after a completed sale. Skips products with null stock_qty. */
export async function decrementProductStock(
  supabase: SupabaseClient,
  businessId: string,
  lines: StockLine[],
): Promise<void> {
  for (const line of lines) {
    const { data: product, error: fetchErr } = await supabase
      .from("operations_products")
      .select("id, stock_qty")
      .eq("business_id", businessId)
      .eq("id", line.product_id)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!product || product.stock_qty == null) continue;

    const current = Number(product.stock_qty);
    const next = current - line.quantity;
    if (next < 0) {
      throw new Error(
        `Insufficient stock for product ${line.product_id}. Available: ${current}`,
      );
    }

    const { error: updateErr } = await supabase
      .from("operations_products")
      .update({ stock_qty: next })
      .eq("business_id", businessId)
      .eq("id", line.product_id)
      .eq("stock_qty", current);

    if (updateErr) throw new Error(updateErr.message);
  }
}

/** Restore stock when a sale is voided. */
export async function restoreProductStock(
  supabase: SupabaseClient,
  businessId: string,
  lines: StockLine[],
): Promise<void> {
  for (const line of lines) {
    const { data: product } = await supabase
      .from("operations_products")
      .select("id, stock_qty")
      .eq("business_id", businessId)
      .eq("id", line.product_id)
      .maybeSingle();

    if (!product || product.stock_qty == null) continue;

    const next = Number(product.stock_qty) + line.quantity;
    await supabase
      .from("operations_products")
      .update({ stock_qty: next })
      .eq("business_id", businessId)
      .eq("id", line.product_id);
  }
}
