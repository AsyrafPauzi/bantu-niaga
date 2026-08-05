import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { emitAndDispatch } from "@/lib/events/dispatcher";
import "@/lib/events/register-handlers";
import type {
  SaleCompletedPayload,
  SaleVoidedPayload,
} from "@/lib/events/sale-payloads";

export async function dispatchSaleCompleted(opts: {
  supabase: SupabaseClient;
  payload: SaleCompletedPayload;
  userId: string;
}): Promise<{ finance_transaction_id: string | null; event_id: string | null }> {
  const eventId = await emitAndDispatch({
    supabase: opts.supabase,
    businessId: opts.payload.business_id,
    name: "sale.completed",
    payload: opts.payload as unknown as Record<string, unknown>,
    userId: opts.userId,
  });

  const { data: sale } = await opts.supabase
    .from("pos_sales")
    .select("finance_transaction_id")
    .eq("id", opts.payload.sale_id)
    .eq("business_id", opts.payload.business_id)
    .maybeSingle();

  return {
    finance_transaction_id: (sale?.finance_transaction_id as string | null) ?? null,
    event_id: eventId,
  };
}

export async function dispatchSaleVoided(opts: {
  supabase: SupabaseClient;
  payload: SaleVoidedPayload;
  userId: string;
}): Promise<void> {
  await emitAndDispatch({
    supabase: opts.supabase,
    businessId: opts.payload.business_id,
    name: "sale.voided",
    payload: opts.payload as unknown as Record<string, unknown>,
    userId: opts.userId,
  });
}
