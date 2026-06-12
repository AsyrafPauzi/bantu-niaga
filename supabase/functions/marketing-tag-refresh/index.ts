/**
 * Bantu Niaga — Marketing M4 nightly auto-tag refresh Edge Function.
 *
 * Deno runtime, TypeScript. Invoked by:
 *   - A `pg_cron` job at 02:30 Asia/Kuala_Lumpur (18:30 UTC) — see the
 *     commented-out schedule block in
 *     `supabase/migrations/00000000000006_marketing_m4.sql`.
 *   - `scripts/backfill-auto-tags.ts` (manual / development invoker;
 *     calls the SQL RPC directly without going through this HTTP
 *     endpoint, so the shared-secret check below isn't a barrier).
 *   - Ad-hoc `curl` from the operator (with the shared secret) for
 *     manual re-runs.
 *
 * Pipeline:
 *   1. Validate the `X-Tag-Refresh-Secret` header against the
 *      `TAG_REFRESH_SHARED_SECRET` env var (set via
 *      `supabase secrets set TAG_REFRESH_SHARED_SECRET=...`).
 *   2. Call `public.marketing_apply_auto_tags_all(p_run_id)` once via
 *      the service-role Supabase client. The RPC handles per-business
 *      iteration + transactional outbox emission internally.
 *   3. Return JSON with per-business counts + a total.
 *
 * Idempotency: the RPC only emits `customer.tag_changed` when the
 * computed tag set differs from the stored one, so a second
 * back-to-back invocation produces zero outbox rows.
 *
 * Plan refs: §6.1, §6.5, §11 M4.
 */
// @ts-nocheck — Deno types diverge from tsc's Node types; the project's
// `tsc` ignores supabase/functions/** by default. We keep this file
// strongly written to runtime contracts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

interface BusinessResult {
  business_id: string;
  updated_count: number | null;
  transitions_count: number | null;
  error_message: string | null;
}

interface Summary {
  run_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  business_count: number;
  total_updated: number;
  total_transitions: number;
  failed_business_count: number;
  per_business: BusinessResult[];
}

const SHARED_SECRET_HEADER = "x-tag-refresh-secret";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sharedSecret = Deno.env.get("TAG_REFRESH_SHARED_SECRET");

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
        "TAG_REFRESH_SHARED_SECRET not set. Run `supabase secrets set TAG_REFRESH_SHARED_SECRET=...` before invoking.",
    });
  }

  const providedSecret = req.headers.get(SHARED_SECRET_HEADER);
  if (!providedSecret || providedSecret !== sharedSecret) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const runId = crypto.randomUUID();
  const startedAt = new Date();

  let rows: BusinessResult[] = [];
  try {
    const { data, error } = await supabase.rpc(
      "marketing_apply_auto_tags_all",
      { p_run_id: runId },
    );
    if (error) {
      console.error(
        "[marketing-tag-refresh] RPC failed",
        JSON.stringify({ run_id: runId, error: error.message }),
      );
      return jsonResponse(500, {
        error: "rpc_failed",
        run_id: runId,
        detail: error.message,
      });
    }
    rows = (data ?? []) as BusinessResult[];
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(
      "[marketing-tag-refresh] unexpected error",
      JSON.stringify({ run_id: runId, error: message }),
    );
    return jsonResponse(500, {
      error: "unexpected",
      run_id: runId,
      detail: message,
    });
  }

  const finishedAt = new Date();

  let totalUpdated = 0;
  let totalTransitions = 0;
  let failedCount = 0;
  for (const r of rows) {
    if (r.error_message) {
      failedCount += 1;
      console.error(
        "[marketing-tag-refresh] per-business failure",
        JSON.stringify({
          run_id: runId,
          business_id: r.business_id,
          error_message: r.error_message,
        }),
      );
      continue;
    }
    totalUpdated += r.updated_count ?? 0;
    totalTransitions += r.transitions_count ?? 0;
  }

  const summary: Summary = {
    run_id: runId,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    business_count: rows.length,
    total_updated: totalUpdated,
    total_transitions: totalTransitions,
    failed_business_count: failedCount,
    per_business: rows,
  };

  console.log(
    "[marketing-tag-refresh] complete",
    JSON.stringify({
      run_id: runId,
      duration_ms: summary.duration_ms,
      business_count: summary.business_count,
      total_updated: summary.total_updated,
      total_transitions: summary.total_transitions,
      failed_business_count: summary.failed_business_count,
    }),
  );

  return jsonResponse(failedCount > 0 ? 207 : 200, summary);
});
