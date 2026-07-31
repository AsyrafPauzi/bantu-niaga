import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { emitDomainEvent, markEventDispatched } from "@/lib/events/emit";
import { handleSaleCompleted } from "@/lib/events/handlers/sale-completed";
import { handleSaleVoided } from "@/lib/events/handlers/sale-voided";
import type {
  SaleCompletedPayload,
  SaleVoidedPayload,
} from "@/lib/events/sale-payloads";

export async function dispatchSaleCompleted(opts: {
  supabase: SupabaseClient;
  payload: SaleCompletedPayload;
  userId: string;
}): Promise<{ finance_transaction_id: string | null; event_id: string | null }> {
  const eventId = await emitDomainEvent({
    supabase: opts.supabase,
    businessId: opts.payload.business_id,
    name: "sale.completed",
    payload: opts.payload as unknown as Record<string, unknown>,
    userId: opts.userId,
  });

  try {
    const result = await handleSaleCompleted({
      supabase: opts.supabase,
      payload: opts.payload,
      userId: opts.userId,
    });
    if (eventId) await markEventDispatched(opts.supabase, eventId);
    return { finance_transaction_id: result.finance_transaction_id, event_id: eventId };
  } catch (e) {
    throw e;
  }
}

export async function dispatchSaleVoided(opts: {
  supabase: SupabaseClient;
  payload: SaleVoidedPayload;
  userId: string;
}): Promise<void> {
  const eventId = await emitDomainEvent({
    supabase: opts.supabase,
    businessId: opts.payload.business_id,
    name: "sale.voided",
    payload: opts.payload as unknown as Record<string, unknown>,
    userId: opts.userId,
  });

  await handleSaleVoided({ supabase: opts.supabase, payload: opts.payload });
  if (eventId) await markEventDispatched(opts.supabase, eventId);
}
