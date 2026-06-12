/**
 * Bantu Niaga — Marketing M4 auto-tags backfill.
 *
 * Calls `public.marketing_apply_auto_tags_all()` directly via a
 * service-role Supabase client. Use this:
 *
 *   1. After M1's seed customers land (no auto_tags yet → first run
 *      populates the array on every row).
 *   2. To re-run the nightly logic on-demand without waiting for the
 *      pg_cron schedule (e.g. after fixing a customer's order_count
 *      from a Finance event).
 *   3. From the smoke-m4 test (re-runs verify idempotency).
 *
 * The SQL RPC is identical to what the Edge Function calls, so this
 * script is the canonical "trigger the nightly job manually" tool.
 *
 * Idempotent: a second invocation produces zero `customer.tag_changed`
 * outbox events because the SQL function only emits on actual
 * transitions.
 *
 * Usage:
 *   npm run backfill:auto-tags
 *
 * Env (loaded from `.env.local` automatically):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Exit codes:
 *   0 — every business processed cleanly
 *   1 — one or more businesses failed (see per-business detail)
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

interface BusinessResult {
  business_id: string;
  updated_count: number | null;
  transitions_count: number | null;
  error_message: string | null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "[backfill-auto-tags] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
    process.exit(2);
  }

  const admin = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const startedAt = Date.now();
  console.log(
    `[backfill-auto-tags] starting marketing_apply_auto_tags_all at ${new Date().toISOString()}`,
  );

  const { data, error } = await admin.rpc("marketing_apply_auto_tags_all");
  if (error) {
    console.error(
      "[backfill-auto-tags] FATAL — RPC marketing_apply_auto_tags_all failed:",
      error.message,
    );
    process.exit(2);
  }

  const rows = (data ?? []) as BusinessResult[];
  const elapsedMs = Date.now() - startedAt;

  let totalUpdated = 0;
  let totalTransitions = 0;
  let failed = 0;

  console.log("");
  console.log("Per-business results:");
  console.log("─".repeat(80));
  console.log(
    `${"business_id".padEnd(40)} ${"updated".padStart(10)} ${"transitions".padStart(13)}  status`,
  );
  console.log("─".repeat(80));
  for (const row of rows) {
    if (row.error_message) {
      failed += 1;
      console.log(
        `${row.business_id.padEnd(40)} ${String("--").padStart(10)} ${String("--").padStart(
          13,
        )}  ERROR: ${row.error_message}`,
      );
      continue;
    }
    totalUpdated += row.updated_count ?? 0;
    totalTransitions += row.transitions_count ?? 0;
    console.log(
      `${row.business_id.padEnd(40)} ${String(row.updated_count ?? 0).padStart(
        10,
      )} ${String(row.transitions_count ?? 0).padStart(13)}  OK`,
    );
  }
  console.log("─".repeat(80));
  console.log(
    `Total: businesses=${rows.length}, customers_scanned=${totalUpdated}, transitions=${totalTransitions}, failed_businesses=${failed}, elapsed_ms=${elapsedMs}`,
  );

  if (failed > 0) {
    console.error(
      `[backfill-auto-tags] ${failed} business(es) failed — see ERROR lines above.`,
    );
    process.exit(1);
  }

  console.log(`[backfill-auto-tags] done (exit 0)`);
}

main().catch((e: unknown) => {
  console.error(
    "[backfill-auto-tags] FATAL:",
    e instanceof Error ? e.stack ?? e.message : e,
  );
  process.exit(2);
});
