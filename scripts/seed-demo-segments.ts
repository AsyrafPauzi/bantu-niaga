/**
 * Bantu Niaga — seed demo custom segments.
 *
 * One-shot: inserts a single custom segment ("Big spenders, last 90 days")
 * for the demo business `11111111-1111-1111-1111-111111111111` so the
 * /marketing/segments surface has real data when the operator opens it.
 *
 * Idempotent: re-running upserts on a fixed UUID so we don't accumulate
 * duplicates. The auto segments are seeded by the migration itself, so
 * this script only handles the custom-row example.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-segments.ts
 *
 * Environment (loaded from .env.local automatically):
 *   NEXT_PUBLIC_SUPABASE_URL       required
 *   SUPABASE_SERVICE_ROLE_KEY      required
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEMO_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_SEGMENT_ID = "20000000-0000-4000-8000-000000000001";

function loadDotEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

async function main(): Promise<void> {
  loadDotEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  console.log("[seed:demo-segments] target business:", DEMO_BUSINESS_ID);

  const { data: business, error: bizErr } = await admin
    .from("businesses")
    .select("id")
    .eq("id", DEMO_BUSINESS_ID)
    .maybeSingle();
  if (bizErr) {
    throw new Error(`failed to look up demo business: ${bizErr.message}`);
  }
  if (!business) {
    throw new Error(
      `demo business ${DEMO_BUSINESS_ID} not found — run seed-demo-businesses first.`,
    );
  }

  const rules = {
    min_spend_myr: 500,
    inactive_days: 0,
    auto_tags_any: [],
  };

  const { error } = await admin
    .from("customer_segments")
    .upsert(
      {
        id: DEMO_SEGMENT_ID,
        business_id: DEMO_BUSINESS_ID,
        name: "Big spenders, last 90 days",
        kind: "custom",
        auto_key: null,
        rules: {
          min_spend_myr: 500,
        },
        member_count: 0,
      },
      { onConflict: "id" },
    )
    .select("id, name");

  if (error) {
    throw new Error(`upsert custom segment failed: ${error.message}`);
  }

  // Touch member_count immediately so the list shows a real value.
  const { count } = await admin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("business_id", DEMO_BUSINESS_ID)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .gte("total_spend_myr", 500);

  const { error: countErr } = await admin
    .from("customer_segments")
    .update({
      member_count: count ?? 0,
      member_count_at: new Date().toISOString(),
    })
    .eq("id", DEMO_SEGMENT_ID);
  if (countErr) {
    throw new Error(`failed to refresh member_count: ${countErr.message}`);
  }

  console.log(
    `[seed:demo-segments] OK — custom segment "${DEMO_SEGMENT_ID}" upserted with ${count ?? 0} members. Rules: ${JSON.stringify(rules)}`,
  );
}

main().catch((err) => {
  console.error(
    "[seed:demo-segments] failed:",
    err instanceof Error ? err.message : err,
  );
  process.exitCode = 1;
});
