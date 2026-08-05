import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type InvoiceIncomeInput = {
  id: string;
  number: string;
  total_myr: number;
  customer_name: string;
};

/** Post ledger income for a paid invoice (idempotent). */
export async function recordInvoiceIncome(
  supabase: SupabaseClient,
  businessId: string,
  userId: string,
  invoice: InvoiceIncomeInput,
  paymentMethod: string = "other",
): Promise<void> {
  const { data: existing } = await supabase
    .from("finance_transactions")
    .select("id")
    .eq("business_id", businessId)
    .eq("finance_invoice_id", invoice.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) return;

  await supabase.from("finance_transactions").insert({
    business_id: businessId,
    kind: "income",
    amount_myr: invoice.total_myr,
    category: "invoice_payment",
    description: `Payment for ${invoice.number}`,
    counterparty: invoice.customer_name,
    payment_method: paymentMethod,
    txn_date: new Date().toISOString().slice(0, 10),
    finance_invoice_id: invoice.id,
    created_by: userId,
  });
}
