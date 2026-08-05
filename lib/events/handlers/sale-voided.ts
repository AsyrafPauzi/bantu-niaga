import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { emitAndDispatch } from "@/lib/events/dispatcher";
import type { SaleVoidedPayload } from "@/lib/events/sale-payloads";

async function claimDedup(
  supabase: SupabaseClient,
  businessId: string,
  saleId: string,
): Promise<boolean> {
  const { error } = await supabase.from("sales_event_dedup").insert({
    business_id: businessId,
    sale_id: saleId,
    event_name: "sale.voided",
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(error.message);
}

/** Sync handler: reverse Finance txn; stock via `stock.restore` event. */
export async function handleSaleVoided(opts: {
  supabase: SupabaseClient;
  payload: SaleVoidedPayload;
  userId: string | null;
}): Promise<void> {
  const { supabase, payload, userId } = opts;
  const claimed = await claimDedup(
    supabase,
    payload.business_id,
    payload.sale_id,
  );
  if (!claimed) return;

  if (payload.finance_transaction_id) {
    await supabase
      .from("finance_transactions")
      .update({ deleted_at: payload.voided_at })
      .eq("id", payload.finance_transaction_id)
      .eq("business_id", payload.business_id);
  }

  const stockLines = payload.line_items
    .filter((l) => l.product_id)
    .map((l) => ({
      product_id: l.product_id as string,
      quantity: l.quantity,
    }));

  if (stockLines.length > 0) {
    await emitAndDispatch({
      supabase,
      businessId: payload.business_id,
      name: "stock.restore",
      payload: {
        business_id: payload.business_id,
        source_type: "sale",
        source_id: payload.sale_id,
        lines: stockLines,
      },
      userId,
    });
  }
}
