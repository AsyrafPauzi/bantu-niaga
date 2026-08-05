import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { emitAndDispatch } from "@/lib/events/dispatcher";
import type { HandlerContext } from "@/lib/events/dispatcher";
import { recordInvoiceIncome } from "@/lib/finance/invoice-income";
import type { InvoicePaidPayload } from "@/lib/events/payloads";

async function claimInvoiceHandlerDedup(
  supabase: SupabaseClient,
  businessId: string,
  invoiceId: string,
  handlerKey: string,
): Promise<boolean> {
  const { error } = await supabase.from("finance_invoice_handler_dedup").insert({
    business_id: businessId,
    invoice_id: invoiceId,
    handler_key: handlerKey,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(error.message);
}

/** Finance income + Operations stock on invoice.paid. */
export async function handleInvoicePaid(ctx: HandlerContext): Promise<void> {
  const payload = ctx.payload as unknown as InvoicePaidPayload;
  const userId =
    ctx.userId ?? payload.actor_user_id ?? payload.created_by ?? payload.business_id;

  await recordInvoiceIncome(
    ctx.supabase,
    payload.business_id,
    userId,
    {
      id: payload.invoice_id,
      number: payload.invoice_number,
      total_myr: payload.total_myr,
      customer_name: payload.customer_name ?? "Customer",
    },
    payload.payment_method ?? "other",
  );

  const stockLines = payload.line_items
    .filter((line) => line.product_id)
    .map((line) => ({
      product_id: line.product_id as string,
      quantity: line.qty,
    }));

  if (stockLines.length === 0) return;

  const claimed = await claimInvoiceHandlerDedup(
    ctx.supabase,
    payload.business_id,
    payload.invoice_id,
    "stock",
  );
  if (!claimed) return;

  await emitAndDispatch({
    supabase: ctx.supabase,
    businessId: payload.business_id,
    name: "stock.decrement",
    payload: {
      business_id: payload.business_id,
      source_type: "invoice",
      source_id: payload.invoice_id,
      lines: stockLines,
    },
    userId: ctx.userId,
  });
}
