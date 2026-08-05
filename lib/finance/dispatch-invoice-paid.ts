import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { emitAndDispatch } from "@/lib/events/dispatcher";
import "@/lib/events/register-handlers";
import type { FinanceInvoiceRow } from "@/lib/finance/schemas";
import type { InvoicePaidPayload } from "@/lib/events/payloads";

export function buildInvoicePaidPayload(
  invoice: FinanceInvoiceRow,
  opts?: {
    paymentMethod?: InvoicePaidPayload["payment_method"];
    actorUserId?: string | null;
  },
): InvoicePaidPayload {
  const paidAt = invoice.paid_at ?? new Date().toISOString();
  return {
    business_id: invoice.business_id,
    invoice_id: invoice.id,
    invoice_number: invoice.number,
    total_myr: Number(invoice.total_myr),
    payment_method: opts?.paymentMethod ?? "other",
    paid_at: paidAt,
    customer_id: invoice.customer_id ?? null,
    customer_name: invoice.customer_name,
    actor_user_id: opts?.actorUserId ?? null,
    created_by: invoice.created_by ?? null,
    line_items: (invoice.items ?? []).map((item) => ({
      product_id: item.product_id ?? null,
      qty: Number(item.quantity),
      unit_price_myr: Number(item.unit_price),
      subtotal_myr: Number(item.line_total_myr),
    })),
  };
}

async function findExistingInvoicePaidEvent(
  supabase: SupabaseClient,
  businessId: string,
  invoiceId: string,
): Promise<{ id: string; dispatched_at: string | null } | null> {
  const { data, error } = await supabase
    .from("events_outbox")
    .select("id, dispatched_at")
    .eq("business_id", businessId)
    .eq("name", "invoice.paid")
    .contains("payload", { invoice_id: invoiceId })
    .order("emitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as { id: string; dispatched_at: string | null } | null;
}

/** Emit and process invoice.paid (idempotent — one outbox row per invoice). */
export async function dispatchInvoicePaid(opts: {
  supabase: SupabaseClient;
  invoice: FinanceInvoiceRow;
  userId: string | null;
  paymentMethod?: InvoicePaidPayload["payment_method"];
}): Promise<string | null> {
  if (opts.invoice.document_kind !== "invoice") return null;

  const payload = buildInvoicePaidPayload(opts.invoice, {
    paymentMethod: opts.paymentMethod,
    actorUserId: opts.userId,
  });

  const existing = await findExistingInvoicePaidEvent(
    opts.supabase,
    opts.invoice.business_id,
    opts.invoice.id,
  );

  if (existing) {
    if (!existing.dispatched_at) {
      return emitAndDispatch({
        supabase: opts.supabase,
        businessId: opts.invoice.business_id,
        name: "invoice.paid",
        payload: payload as unknown as Record<string, unknown>,
        userId: opts.userId,
        existingEventId: existing.id,
      });
    }
    return existing.id;
  }

  return emitAndDispatch({
    supabase: opts.supabase,
    businessId: opts.invoice.business_id,
    name: "invoice.paid",
    payload: payload as unknown as Record<string, unknown>,
    userId: opts.userId,
  });
}
