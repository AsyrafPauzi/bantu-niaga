/**
 * Bantu Niaga — Marketing M6 cross-pillar event listener.
 *
 * Deno runtime, TypeScript. This is the LOCAL poller that stands in
 * for the still-missing global events_outbox dispatcher (dependency
 * D8 from `marketing-implementation-plan.md` §3.3). It calls the
 * idempotent `public.marketing_apply_metric_events_batch(p_limit)`
 * RPC and returns per-event outcomes.
 *
 * Mirrors the structure of `marketing-tag-refresh/index.ts`:
 *   1. POST-only.
 *   2. Validate `X-Marketing-Listener-Secret` header against the
 *      MARKETING_LISTENER_SHARED_SECRET env var.
 *   3. Call the batch RPC via the service-role Supabase client.
 *   4. Aggregate per-event outcomes and return JSON.
 *      - HTTP 200 on success (all events applied or legitimately
 *        skipped, no errors).
 *      - HTTP 207 on partial failure (some events landed in dedup
 *        with outcome=error).
 *      - HTTP 500 on total failure (RPC error, env missing, etc.).
 *
 * Invocation paths in v1:
 *   - `pg_cron` schedule (commented-out wiring block at the bottom
 *     of `supabase/migrations/00000000000007_marketing_m6.sql`).
 *   - Operator `curl` for ad-hoc reprocessing after a bad batch.
 *   - `scripts/backfill-marketing-events.ts` calls the RPC directly
 *     via service-role and bypasses this HTTP wrapper entirely.
 *
 * When dependency D8 lands, this poller can be retired — the SQL
 * RPC is dispatcher-agnostic and the global dispatcher can call
 * `marketing_apply_metric_event(event_id)` per-event instead.
 *
 * Plan refs: §3.2, §3.3 D8, §11 M6.
 */
// @ts-nocheck — Deno types diverge from tsc's Node types; the project's
// `tsc` ignores supabase/functions/** by default. Runtime contracts only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

interface BatchRow {
  event_id: string;
  event_name: string;
  outcome: string;
  applied: boolean;
  error_message: string | null;
}

interface Summary {
  run_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  batch_limit: number;
  processed_count: number;
  applied_count: number;
  skipped_already_processed_count: number;
  skipped_no_customer_count: number;
  skipped_cross_business_count: number;
  skipped_unsupported_event_count: number;
  skipped_no_event_count: number;
  error_count: number;
  per_event: BatchRow[];
}

const SHARED_SECRET_HEADER = "x-marketing-listener-secret";
const DEFAULT_BATCH_LIMIT = 100;
const MAX_BATCH_LIMIT = 1000;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseBatchLimit(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(1, Math.min(MAX_BATCH_LIMIT, Math.floor(raw)));
  }
  if (typeof raw === "string") {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) {
      return Math.max(1, Math.min(MAX_BATCH_LIMIT, n));
    }
  }
  return DEFAULT_BATCH_LIMIT;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sharedSecret = Deno.env.get("MARKETING_LISTENER_SHARED_SECRET");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, {
      error: "server_misconfigured",
      detail:
        "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var missing in the function environment.",
    });
  }

  if (!sharedSecret) {
    return jsonResponse(500, {
      error: "server_misconfigured",
      detail:
        "MARKETING_LISTENER_SHARED_SECRET not set. Run `supabase secrets set MARKETING_LISTENER_SHARED_SECRET=...` before invoking.",
    });
  }

  const providedSecret = req.headers.get(SHARED_SECRET_HEADER);
  if (!providedSecret || providedSecret !== sharedSecret) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  let body: unknown = null;
  try {
    const text = await req.text();
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  const requested =
    body && typeof body === "object" && "limit" in body
      ? (body as Record<string, unknown>).limit
      : null;
  const batchLimit = parseBatchLimit(requested);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const runId = crypto.randomUUID();
  const startedAt = new Date();

  let rows: BatchRow[] = [];
  try {
    const { data, error } = await supabase.rpc(
      "marketing_apply_metric_events_batch",
      { p_limit: batchLimit },
    );
    if (error) {
      console.error(
        "[marketing-event-listener] RPC failed",
        JSON.stringify({ run_id: runId, error: error.message }),
      );
      return jsonResponse(500, {
        error: "rpc_failed",
        run_id: runId,
        detail: error.message,
      });
    }
    rows = (data ?? []) as BatchRow[];
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(
      "[marketing-event-listener] unexpected error",
      JSON.stringify({ run_id: runId, error: message }),
    );
    return jsonResponse(500, {
      error: "unexpected",
      run_id: runId,
      detail: message,
    });
  }

  const finishedAt = new Date();

  const counts = {
    applied: 0,
    skipped_already_processed: 0,
    skipped_no_customer: 0,
    skipped_cross_business: 0,
    skipped_unsupported_event: 0,
    skipped_no_event: 0,
    error: 0,
  };
  for (const r of rows) {
    if (r.outcome === "applied") counts.applied += 1;
    else if (r.outcome === "skipped_already_processed")
      counts.skipped_already_processed += 1;
    else if (r.outcome === "skipped_no_customer")
      counts.skipped_no_customer += 1;
    else if (r.outcome === "skipped_cross_business")
      counts.skipped_cross_business += 1;
    else if (r.outcome === "skipped_unsupported_event")
      counts.skipped_unsupported_event += 1;
    else if (r.outcome === "skipped_no_event") counts.skipped_no_event += 1;
    else if (r.outcome === "error") counts.error += 1;
  }

  const summary: Summary = {
    run_id: runId,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    batch_limit: batchLimit,
    processed_count: rows.length,
    applied_count: counts.applied,
    skipped_already_processed_count: counts.skipped_already_processed,
    skipped_no_customer_count: counts.skipped_no_customer,
    skipped_cross_business_count: counts.skipped_cross_business,
    skipped_unsupported_event_count: counts.skipped_unsupported_event,
    skipped_no_event_count: counts.skipped_no_event,
    error_count: counts.error,
    per_event: rows,
  };

  console.log(
    "[marketing-event-listener] complete",
    JSON.stringify({
      run_id: runId,
      duration_ms: summary.duration_ms,
      processed_count: summary.processed_count,
      applied_count: summary.applied_count,
      error_count: summary.error_count,
    }),
  );

  const status = counts.error > 0 ? 207 : 200;
  return jsonResponse(status, summary);
});
