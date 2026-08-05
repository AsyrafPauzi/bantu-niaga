import "server-only";

import type { HandlerContext } from "@/lib/events/dispatcher";

/**
 * Applies Marketing CRM metric updates via the M6 SQL listener.
 * Idempotent on `events_outbox.id` (marketing_event_dedup).
 */
export async function handleMarketingMetricEvent(
  ctx: HandlerContext,
): Promise<void> {
  const { data, error } = await ctx.supabase.rpc("marketing_apply_metric_event", {
    p_event_id: ctx.eventId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as { outcome?: string; error_message?: string } | undefined;
  if (row?.outcome === "error") {
    throw new Error(row.error_message ?? "marketing_apply_metric_event failed");
  }
}

/** Acknowledge informational customer lifecycle events (no metric mutation). */
export async function handleCustomerOutboxAck(
  _ctx: HandlerContext,
): Promise<void> {
  // Persisted for audit / Home feed; no sync side-effects in v1.
}
