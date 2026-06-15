/**
 * Bantu Niaga — seed demo coupons.
 *
 * Inserts two demo coupons against the demo business
 * `11111111-1111-1111-1111-111111111111` so /marketing/coupons has
 * something real on first open:
 *
 *   1. RAYA20      PCT 20%, min subtotal RM50, valid 90 days,
 *                  per_customer_limit=1.
 *   2. WELCOME10   AMT RM10, no min, valid 365 days, total_limit=50,
 *                  per_customer_limit=1.
 *
 * Idempotent: every insert uses a deterministic UUID + onConflict so
 * re-running lines up the demo state with whatever this script
 * currently says.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-coupons.ts
 *
 * Environment (resolved from .env.local automatically):
 *   NEXT_PUBLIC_SUPABASE_URL       required
 *   SUPABASE_SERVICE_ROLE_KEY      required
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEMO_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";

interface DemoCoupon {
  id: string;
  code: string;
  name: string;
  type: "PCT" | "AMT";
  value: number;
  min_subtotal_myr: number;
  valid_days: number;
  total_limit: number | null;
  per_customer_limit: number;
}

const COUPONS: DemoCoupon[] = [
  {
    id: "20000000-0000-4000-8000-0000000000c1",
    code: "RAYA20",
    name: "Hari Raya — 20% off",
    type: "PCT",
    value: 20,
    min_subtotal_myr: 50,
    valid_days: 90,
    total_limit: null,
    per_customer_limit: 1,
  },
  {
    id: "20000000-0000-4000-8000-0000000000c2",
    code: "WELCOME10",
    name: "Welcome — RM10 off",
    type: "AMT",
    value: 10,
    min_subtotal_myr: 0,
    valid_days: 365,
    total_limit: 50,
    per_customer_limit: 1,
  },
];

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

  console.log("[seed:demo-coupons] target business:", DEMO_BUSINESS_ID);

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

  const now = new Date();

  for (const c of COUPONS) {
    const validFrom = now.toISOString();
    const validUntil = new Date(
      now.getTime() + c.valid_days * 86_400_000,
    ).toISOString();

    const { error } = await admin
      .from("coupons")
      .upsert(
        {
          id: c.id,
          business_id: DEMO_BUSINESS_ID,
          code: c.code,
          name: c.name,
          type: c.type,
          value: c.value,
          min_subtotal_myr: c.min_subtotal_myr,
          valid_from: validFrom,
          valid_until: validUntil,
          total_limit: c.total_limit,
          per_customer_limit: c.per_customer_limit,
          status: "active",
          deleted_at: null,
        },
        { onConflict: "id" },
      )
      .select("id, code");

    if (error) {
      throw new Error(`upsert coupon ${c.code} failed: ${error.message}`);
    }

    console.log(
      `[seed:demo-coupons] OK — ${c.code} (${c.type} ${c.value}${c.type === "PCT" ? "%" : " MYR"}) valid ${c.valid_days}d`,
    );
  }
}

main().catch((err) => {
  console.error(
    "[seed:demo-coupons] failed:",
    err instanceof Error ? err.message : err,
  );
  process.exitCode = 1;
});
