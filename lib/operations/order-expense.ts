import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyFinanceTransactionCreated } from "@/lib/finance/notify";

export type RecordExpenseResult =
  | { ok: true; expenseId: string; created: boolean; href: string }
  | {
      ok: false;
      reason:
        | "not_found"
        | "no_amount"
        | "already_recorded"
        | "forbidden"
        | "create_failed";
      expenseId?: string;
      href?: string;
    };

/** Create a finance expense from an operations order (idempotent). */
export async function recordExpenseFromOrder(
  supabase: SupabaseClient,
  opts: {
    businessId: string;
    orderId: string;
    userId: string;
    canFinance: boolean;
  },
): Promise<RecordExpenseResult> {
  if (!opts.canFinance) {
    return { ok: false, reason: "forbidden" };
  }

  const { data: order, error: orderErr } = await supabase
    .from("operations_orders")
    .select(
      "id, number, title, amount_myr, customer_name, supplier_id, admin_file_id, operations_suppliers(name)",
    )
    .eq("business_id", opts.businessId)
    .eq("id", opts.orderId)
    .is("deleted_at", null)
    .maybeSingle();

  if (orderErr || !order) {
    return { ok: false, reason: "not_found" };
  }

  const amount = order.amount_myr != null ? Number(order.amount_myr) : 0;
  if (amount <= 0) {
    return { ok: false, reason: "no_amount" };
  }

  const { data: existing } = await supabase
    .from("finance_transactions")
    .select("id")
    .eq("business_id", opts.businessId)
    .eq("operations_order_id", opts.orderId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    const expenseId = existing.id as string;
    return {
      ok: false,
      reason: "already_recorded",
      expenseId,
      href: `/finance/expenses?txn=${expenseId}`,
    };
  }

  const supplier = order.operations_suppliers as { name?: string } | null;
  const counterparty = supplier?.name ?? order.customer_name ?? null;
  const description = `Order ${order.number}: ${order.title}`;

  const { data: txn, error: txnErr } = await supabase
    .from("finance_transactions")
    .insert({
      business_id: opts.businessId,
      kind: "expense",
      amount_myr: amount,
      category: "supplies",
      description,
      counterparty,
      txn_date: new Date().toISOString().slice(0, 10),
      admin_file_id: (order.admin_file_id as string | null) ?? null,
      operations_order_id: opts.orderId,
      created_by: opts.userId,
    })
    .select("id, description, amount_myr")
    .single();

  if (txnErr || !txn) {
    return { ok: false, reason: "create_failed" };
  }

  const expenseId = txn.id as string;
  notifyFinanceTransactionCreated({
    businessId: opts.businessId,
    kind: "expense",
    description: txn.description as string,
    amountMyr: Number(txn.amount_myr),
    txnId: expenseId,
  });

  return {
    ok: true,
    expenseId,
    created: true,
    href: `/finance/expenses?txn=${expenseId}`,
  };
}
