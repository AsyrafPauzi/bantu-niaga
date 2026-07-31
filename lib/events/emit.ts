import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SaleEventName } from "@/lib/events/sale-payloads";

export async function emitDomainEvent(opts: {
  supabase: SupabaseClient;
  businessId: string;
  name: SaleEventName | string;
  payload: Record<string, unknown>;
  userId: string | null;
}): Promise<string | null> {
  const { data, error } = await opts.supabase
    .from("events_outbox")
    .insert({
      business_id: opts.businessId,
      name: opts.name,
      payload: opts.payload,
      emitted_by_user_id: opts.userId,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data?.id as string | null;
}

export async function markEventDispatched(
  supabase: SupabaseClient,
  eventId: string,
): Promise<void> {
  const { error } = await supabase
    .from("events_outbox")
    .update({ dispatched_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
}
