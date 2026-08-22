import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyFinanceTransactionCreated } from "@/lib/finance/notify";
import { notifyFinanceInvoicePaid } from "@/lib/finance/notify";

export interface RecordPaymentInput {
  invoiceId: string;
  businessId: string;
  userId: string;
  /** Amount being paid in this instalment (must be > 0 and ≤ remaining balance). */
  amountMyr: number;
  paymentMethod?: string | null;
  /** Date of payment (YYYY-MM-DD). Defaults to today. */
  paymentDate?: string;
  notes?: string | null;
}

export type RecordPaymentResult =
  | {
      ok: true;
      txnId: string;
      newAmountPaid: number;
      newStatus: "partially_paid" | "paid";
      fullyPaid: boolean;
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "already_paid"
        | "void"
        | "exceeds_balance"
        | "invalid_amount"
        | "create_failed";
      message: string;
    };

/**
 * Record one payment (deposit or final) against an invoice.
 * Updates amount_paid_myr and sets status to partially_paid or paid.
 * Creates a finance_transactions income row for the ledger.
 * Safe to call multiple times for the same invoice.
 */
export async function recordInvoicePayment(
  supabase: SupabaseClient,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  if (!Number.isFinite(input.amountMyr) || input.amountMyr <= 0) {
    return { ok: false, reason: "invalid_amount", message: "Amount must be greater than 0." };
  }

  // Load the invoice
  const { data: invoice, error: fetchErr } = await supabase
    .from("finance_invoices")
    .select(
      "id, number, total_myr, amount_paid_myr, status, customer_name, customer_id, document_kind",
    )
    .eq("id", input.invoiceId)
    .eq("business_id", input.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr || !invoice) {
    return { ok: false, reason: "not_found", message: "Invoice not found." };
  }

  if (invoice.status === "void") {
    return { ok: false, reason: "void", message: "Cannot record payment on a voided invoice." };
  }

  if (invoice.status === "paid") {
    return {
      ok: false,
      reason: "already_paid",
      message: "Invoice is already fully paid.",
    };
  }

  const total = Number(invoice.total_myr);
  const alreadyPaid = Number(invoice.amount_paid_myr ?? 0);
  const remaining = total - alreadyPaid;

  if (input.amountMyr > remaining + 0.005) {
    return {
      ok: false,
      reason: "exceeds_balance",
      message: `Payment of RM ${input.amountMyr.toFixed(2)} exceeds remaining balance of RM ${remaining.toFixed(2)}.`,
    };
  }

  const newAmountPaid = alreadyPaid + input.amountMyr;
  const fullyPaid = newAmountPaid >= total - 0.005;
  const newStatus: "partially_paid" | "paid" = fullyPaid ? "paid" : "partially_paid";
  const txnDate =
    input.paymentDate ?? new Date().toISOString().slice(0, 10);
  const description = fullyPaid
    ? `Payment for ${invoice.number as string}`
    : `Deposit/payment for ${invoice.number as string} (RM ${alreadyPaid.toFixed(2)} + RM ${input.amountMyr.toFixed(2)})`;

  // Insert ledger transaction
  const { data: txn, error: txnErr } = await supabase
    .from("finance_transactions")
    .insert({
      business_id: input.businessId,
      kind: "income",
      amount_myr: input.amountMyr,
      category: "invoice_payment",
      description,
      counterparty: invoice.customer_name as string,
      customer_id: (invoice.customer_id as string | null) ?? null,
      payment_method: input.paymentMethod ?? "other",
      txn_date: txnDate,
      finance_invoice_id: input.invoiceId,
      created_by: input.userId,
    })
    .select("id, description, amount_myr")
    .single();

  if (txnErr || !txn) {
    return { ok: false, reason: "create_failed", message: "Could not record transaction." };
  }

  // Update invoice
  const invoicePatch: Record<string, unknown> = {
    amount_paid_myr: newAmountPaid,
    status: newStatus,
  };
  if (fullyPaid) {
    invoicePatch.paid_at = new Date().toISOString();
    invoicePatch.share_expires_at = null;
  }

  await supabase
    .from("finance_invoices")
    .update(invoicePatch)
    .eq("id", input.invoiceId)
    .eq("business_id", input.businessId);

  notifyFinanceTransactionCreated({
    businessId: input.businessId,
    kind: "income",
    description: txn.description as string,
    amountMyr: Number(txn.amount_myr),
    txnId: txn.id as string,
  });

  if (fullyPaid) {
    notifyFinanceInvoicePaid({
      businessId: input.businessId,
      invoiceId: input.invoiceId,
      number: invoice.number as string,
      customerName: (invoice.customer_name as string) || "Customer",
      totalMyr: total,
    });
  }

  return {
    ok: true,
    txnId: txn.id as string,
    newAmountPaid,
    newStatus,
    fullyPaid,
  };
}
