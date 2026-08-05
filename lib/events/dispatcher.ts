import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emitDomainEvent,
  markEventDispatched,
  recordDispatchError,
} from "@/lib/events/emit";

export type HandlerContext = {
  supabase: SupabaseClient;
  businessId: string;
  payload: Record<string, unknown>;
  userId: string | null;
  eventId: string;
};

export type SyncEventHandler = (ctx: HandlerContext) => Promise<void>;

const syncHandlers = new Map<string, SyncEventHandler[]>();

export function registerSyncHandler(
  name: string,
  handler: SyncEventHandler,
): void {
  const list = syncHandlers.get(name) ?? [];
  list.push(handler);
  syncHandlers.set(name, list);
}

export function getSyncHandlers(name: string): SyncEventHandler[] {
  return syncHandlers.get(name) ?? [];
}

/**
 * Persist to `events_outbox`, run registered sync handlers, mark dispatched.
 * On failure, records `last_error` + increments `attempts` for cron replay.
 */
export async function emitAndDispatch(opts: {
  supabase: SupabaseClient;
  businessId: string;
  name: string;
  payload: Record<string, unknown>;
  userId: string | null;
  existingEventId?: string | null;
}): Promise<string | null> {
  let eventId = opts.existingEventId ?? null;
  if (!eventId) {
    eventId = await emitDomainEvent({
      supabase: opts.supabase,
      businessId: opts.businessId,
      name: opts.name,
      payload: opts.payload,
      userId: opts.userId,
    });
  }

  if (!eventId) return null;

  const handlers = getSyncHandlers(opts.name);
  if (handlers.length === 0) {
    await markEventDispatched(opts.supabase, eventId);
    return eventId;
  }

  const ctx: HandlerContext = {
    supabase: opts.supabase,
    businessId: opts.businessId,
    payload: opts.payload,
    userId: opts.userId,
    eventId,
  };

  try {
    for (const handler of handlers) {
      await handler(ctx);
    }
    await markEventDispatched(opts.supabase, eventId);
  } catch (error) {
    await recordDispatchError(opts.supabase, eventId, error);
    throw error;
  }

  return eventId;
}

/** Replay undispatched outbox rows (cron / recovery). */
export async function processUndispatchedOutbox(
  supabase: SupabaseClient,
  opts?: { limit?: number; maxAttempts?: number },
): Promise<Array<{ id: string; name: string; ok: boolean; error?: string }>> {
  const limit = opts?.limit ?? 50;
  const maxAttempts = opts?.maxAttempts ?? 5;

  const { data: rows, error } = await supabase
    .from("events_outbox")
    .select("id, business_id, name, payload, emitted_by_user_id, attempts")
    .is("dispatched_at", null)
    .lt("attempts", maxAttempts)
    .order("emitted_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const results: Array<{ id: string; name: string; ok: boolean; error?: string }> =
    [];

  for (const row of rows ?? []) {
    try {
      await emitAndDispatch({
        supabase,
        businessId: row.business_id as string,
        name: row.name as string,
        payload: row.payload as Record<string, unknown>,
        userId: (row.emitted_by_user_id as string | null) ?? null,
        existingEventId: row.id as string,
      });
      results.push({ id: row.id as string, name: row.name as string, ok: true });
    } catch (e) {
      results.push({
        id: row.id as string,
        name: row.name as string,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return results;
}
