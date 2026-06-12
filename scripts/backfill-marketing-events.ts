/**
 * Bantu Niaga — Marketing M6 cross-pillar event backfill / poll.
 *
 * Calls `public.marketing_apply_metric_events_batch()` directly via a
 * service-role Supabase client. This is the operator's "drain the
 * outbox now" tool — it bypasses the HTTP Edge Function and is safe
 * to run repeatedly. Use this:
 *
 *   1. Before the global events_outbox dispatcher (D8) lands, to
 *      replay any Marketing-consumed events that piled up.
 *   2. After deploying a fix to the metric handler — re-runs are
 *      idempotent because the dedup table short-circuits already-
 *      processed events.
 *   3. From `scripts/smoke-m6.ts` (synthetic event end-to-end).
 *
 * The SQL RPC is what the Edge Function calls, so this script is the
 * canonical "trigger the M6 listener manually" tool.
 *
 * Usage:
 *   npm run backfill:marketing-events          # default batch of 100
 *   npm run backfill:marketing-events -- 500   # custom batch size
 *
 * Env (loaded from `.env.local` automatically):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Exit codes:
 *   0 — batch drained cleanly (zero errors); applied + skipped sum
 *       printed for operator visibility
 *   1 — one or more events errored (see ERROR lines)
 *   2 — fatal (RPC error, env missing, etc.)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadDotEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const contents = readFileSync(envPath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnvLocal();

interface BatchRow {
  event_id: string;
  event_name: string;
  outcome: string;
  applied: boolean;
  error_message: string | null;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

function parseLimitArg(): number {
  const raw = process.argv[2];
  if (raw == null) return DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    console.error(
      `[backfill-marketing-events] Invalid limit ${JSON.stringify(raw)}; using default ${DEFAULT_LIMIT}.`,
    );
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, n);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "[backfill-marketing-events] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
    process.exit(2);
  }

  const limit = parseLimitArg();
  const admin = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const startedAt = Date.now();
  console.log(
    `[backfill-marketing-events] starting marketing_apply_metric_events_batch(${limit}) at ${new Date().toISOString()}`,
  );

  const { data, error } = await admin.rpc(
    "marketing_apply_metric_events_batch",
    { p_limit: limit },
  );
  if (error) {
    console.error(
      "[backfill-marketing-events] FATAL — RPC marketing_apply_metric_events_batch failed:",
      error.message,
    );
    process.exit(2);
  }

  const rows = (data ?? []) as BatchRow[];
  const elapsedMs = Date.now() - startedAt;

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
    const key = r.outcome as keyof typeof counts;
    if (key in counts) counts[key] += 1;
  }

  console.log("");
  console.log("Per-event results:");
  console.log("─".repeat(96));
  console.log(
    `${"event_id".padEnd(36)}  ${"event_name".padEnd(20)}  ${"outcome".padEnd(28)}  applied`,
  );
  console.log("─".repeat(96));
  for (const row of rows) {
    const applied = row.applied ? "yes" : "no";
    console.log(
      `${row.event_id.padEnd(36)}  ${row.event_name.padEnd(20)}  ${row.outcome.padEnd(28)}  ${applied}`,
    );
    if (row.error_message) {
      console.log(`                                      ↳ ${row.error_message}`);
    }
  }
  console.log("─".repeat(96));
  console.log(
    `Totals: processed=${rows.length} applied=${counts.applied} ` +
      `skipped_already_processed=${counts.skipped_already_processed} ` +
      `skipped_no_customer=${counts.skipped_no_customer} ` +
      `skipped_cross_business=${counts.skipped_cross_business} ` +
      `skipped_unsupported_event=${counts.skipped_unsupported_event} ` +
      `skipped_no_event=${counts.skipped_no_event} ` +
      `error=${counts.error} elapsed_ms=${elapsedMs}`,
  );

  if (counts.error > 0) {
    console.error(
      `[backfill-marketing-events] ${counts.error} event(s) errored — see ERROR lines above.`,
    );
    process.exit(1);
  }

  console.log(`[backfill-marketing-events] done (exit 0)`);
}

main().catch((e: unknown) => {
  console.error(
    "[backfill-marketing-events] FATAL:",
    e instanceof Error ? e.stack ?? e.message : e,
  );
  process.exit(2);
});
