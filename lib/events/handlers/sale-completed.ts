import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { postPosSaleToFinance } from "@/lib/sales/checkout";
import { decrementProductStock } from "@/lib/sales/stock";
import type { SaleCompletedPayload } from "@/lib/events/sale-payloads";

async function claimDedup(
  supabase: SupabaseClient,
  businessId: string,
  saleId: string,
  eventName: "sale.completed",
): Promise<boolean> {
  const { error } = await supabase.from("sales_event_dedup").insert({
    business_id: businessId,
    sale_id: saleId,
    event_name: eventName,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(error.message);
}

/** Sync handler: Finance income + Operations stock decrement. */
export async function handleSaleCompleted(opts: {
  supabase: SupabaseClient;
  payload: SaleCompletedPayload;
  userId: string;
}): Promise<{ finance_transaction_id: string | null }> {
  const { supabase, payload, userId } = opts;
  const claimed = await claimDedup(
    supabase,
    payload.business_id,
    payload.sale_id,
    "sale.completed",
  );
  if (!claimed) {
    const { data: sale } = await supabase
      .from("pos_sales")
      .select("finance_transaction_id")
      .eq("id", payload.sale_id)
      .eq("business_id", payload.business_id)
      .maybeSingle();
    return { finance_transaction_id: sale?.finance_transaction_id ?? null };
  }

  const stockLines = payload.line_items
    .filter((l) => l.product_id)
    .map((l) => ({
      product_id: l.product_id as string,
      quantity: l.quantity,
    }));

  if (stockLines.length > 0) {
    await decrementProductStock(supabase, payload.business_id, stockLines);
  }

  const financeTransactionId = await postPosSaleToFinance({
    supabase,
    businessId: payload.business_id,
    userId,
    saleId: payload.sale_id,
    saleNumber: payload.sale_number,
    totalMyr: payload.total_myr,
    paymentMethod: payload.payment_method,
    customerName: payload.customer_name,
  });

  return { finance_transaction_id: financeTransactionId };
}
