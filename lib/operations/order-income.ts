import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyFinanceTransactionCreated } from "@/lib/finance/notify";

/**
 * Auto-record income when an order is marked done (idempotent).
 * Only creates a transaction if the order has amount_myr > 0 and no income row exists yet.
 * (The separate recordExpenseFromOrder handles the cost side.)
 */
export async function recordIncomeFromOrder(
  supabase: SupabaseClient,
  opts: {
    businessId: string;
    orderId: string;
    userId: string;
  },
): Promise<{ ok: boolean; reason?: string }> {
  const { data: order, error: orderErr } = await supabase
    .from("operations_orders")
    .select("id, number, title, amount_myr, customer_name")
    .eq("business_id", opts.businessId)
    .eq("id", opts.orderId)
    .is("deleted_at", null)
    .maybeSingle();

  if (orderErr || !order) return { ok: false, reason: "not_found" };

  const amount = order.amount_myr != null ? Number(order.amount_myr) : 0;
  if (amount <= 0) return { ok: false, reason: "no_amount" };

  // Check if income was already recorded (kind = income for this order)
  const { data: existing } = await supabase
    .from("finance_transactions")
    .select("id")
    .eq("business_id", opts.businessId)
    .eq("operations_order_id", opts.orderId)
    .eq("kind", "income")
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) return { ok: false, reason: "already_recorded" };

  const { data: txn, error: txnErr } = await supabase
    .from("finance_transactions")
    .insert({
      business_id: opts.businessId,
      kind: "income",
      amount_myr: amount,
      category: "order_payment",
      description: `Order ${order.number as string}: ${order.title as string}`,
      counterparty: order.customer_name as string,
      payment_method: "other",
      txn_date: new Date().toISOString().slice(0, 10),
      operations_order_id: opts.orderId,
      created_by: opts.userId,
    })
    .select("id, description, amount_myr")
    .single();

  if (txnErr || !txn) return { ok: false, reason: "create_failed" };

  notifyFinanceTransactionCreated({
    businessId: opts.businessId,
    kind: "income",
    description: txn.description as string,
    amountMyr: Number(txn.amount_myr),
    txnId: txn.id as string,
  });

  return { ok: true };
}
