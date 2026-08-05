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
    .update({ dispatched_at: new Date().toISOString(), last_error: null })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
}

export async function recordDispatchError(
  supabase: SupabaseClient,
  eventId: string,
  error: unknown,
): Promise<void> {
  const { data: row } = await supabase
    .from("events_outbox")
    .select("attempts")
    .eq("id", eventId)
    .maybeSingle();

  const message = error instanceof Error ? error.message : String(error);
  const { error: updateErr } = await supabase
    .from("events_outbox")
    .update({
      attempts: (row?.attempts as number | undefined ?? 0) + 1,
      last_error: message.slice(0, 2000),
    })
    .eq("id", eventId);

  if (updateErr) throw new Error(updateErr.message);
}
