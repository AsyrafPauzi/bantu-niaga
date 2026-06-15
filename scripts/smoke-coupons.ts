/**
 * Bantu Niaga — Marketing v1.1 coupons smoke test.
 *
 * Drives the coupons API end-to-end against a locally-running
 * `npm run dev` server and the remote Supabase project configured in
 * `.env.local`. Mirrors the smoke-m4 / smoke-m6 patterns.
 *
 * Asserts:
 *   - GET /api/marketing/coupons returns the two demo coupons.
 *   - POST /api/marketing/coupons/validate with RAYA20 + subtotal=100
 *     yields ok=true, discount=20.
 *   - POST /api/marketing/coupons/validate with RAYA20 + subtotal=10
 *     yields ok=false, reason=min_subtotal.
 *   - POST /api/marketing/coupons/redeem with WELCOME10 + customer
 *     succeeds.
 *   - Re-validating WELCOME10 as the same customer yields
 *     reason=per_customer_limit_reached.
 *
 * Cleans up the redemption row on exit so re-runs stay deterministic.
 *
 * Usage:
 *   npm run smoke:coupons
 *
 * Env overrides:
 *   APP_URL                — default http://localhost:3000
 *   SEED_OWNER_EMAIL       — default owner@demo.bantuniaga.local
 *   SEED_OWNER_PASSWORD    — default DemoPassword!2026
 *   SMOKE_BUSINESS_ID      — default 11111111-1111-1111-1111-111111111111
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

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
loadDotEnvLocal();

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SEED_EMAIL =
  process.env.SEED_OWNER_EMAIL ?? "owner@demo.bantuniaga.local";
const SEED_PASSWORD =
  process.env.SEED_OWNER_PASSWORD ?? "DemoPassword!2026";
const BUSINESS_ID =
  process.env.SMOKE_BUSINESS_ID ?? "11111111-1111-1111-1111-111111111111";

if (!SUPABASE_URL || !SUPABASE_ANON || !SUPABASE_SERVICE) {
  console.error(
    "[smoke-coupons] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exit(2);
}

interface CookieEntry {
  name: string;
  value: string;
  options?: CookieOptions;
}
class CookieJar {
  private store = new Map<string, CookieEntry>();
  getAll(): CookieEntry[] {
    return Array.from(this.store.values());
  }
  setAll(items: CookieEntry[]) {
    for (const item of items) {
      if (item.value === "") this.store.delete(item.name);
      else this.store.set(item.name, item);
    }
  }
  toHeader(): string {
    return this.getAll()
      .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
      .join("; ");
  }
}

async function signIn(email: string, password: string): Promise<CookieJar> {
  const jar = new CookieJar();
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(items: CookieEntry[]) {
        jar.setAll(items);
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`);
  await client.auth.getSession();
  if (jar.getAll().length === 0) {
    throw new Error(`signIn(${email}) returned no session cookies`);
  }
  return jar;
}

async function call(
  jar: CookieJar,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const cookieHeader = jar.toHeader();
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  let init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init = { ...init, body: JSON.stringify(body) };
  }
  const res = await fetch(`${APP_URL}${path}`, init);
  const raw = await res.text();
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* keep as text */
  }
  return { status: res.status, body: parsed };
}

const results: { id: number; title: string; ok: boolean; detail?: string }[] =
  [];
function record(id: number, title: string, ok: boolean, detail?: string) {
  results.push({ id, title, ok, detail });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`[${tag}] #${id} ${title}${detail ? `\n        ${detail}` : ""}`);
}

async function main(): Promise<void> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // Pick a customer in the demo business to bind the redemption to.
  const { data: customer, error: custErr } = await admin
    .from("customers")
    .select("id")
    .eq("business_id", BUSINESS_ID)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (custErr) throw new Error(`customer lookup: ${custErr.message}`);
  if (!customer) {
    throw new Error(
      `no customer in business ${BUSINESS_ID} — run seed-demo-businesses first.`,
    );
  }
  const customerId = customer.id as string;
  console.log("[smoke-coupons] using customer:", customerId);

  const createdRedemptionIds: string[] = [];

  try {
    const jar = await signIn(SEED_EMAIL, SEED_PASSWORD);

    // 1) GET /api/marketing/coupons returns at least the 2 demo coupons.
    {
      const r = await call(jar, "GET", "/api/marketing/coupons");
      const data = (r.body as { data?: unknown[] }).data ?? [];
      const codes = data.map((c) => (c as { code: string }).code);
      record(
        1,
        "GET /api/marketing/coupons lists demo coupons",
        r.status === 200 &&
          codes.includes("RAYA20") &&
          codes.includes("WELCOME10"),
        `status=${r.status} codes=${JSON.stringify(codes)}`,
      );
    }

    // 2) Validate RAYA20 with subtotal=100 → ok, discount=20.
    {
      const r = await call(jar, "POST", "/api/marketing/coupons/validate", {
        code: "RAYA20",
        subtotal_myr: 100,
      });
      const body = r.body as { ok?: boolean; discount_myr?: number };
      record(
        2,
        "Validate RAYA20 + subtotal=100 → ok, discount=20",
        r.status === 200 && body.ok === true && body.discount_myr === 20,
        JSON.stringify(body),
      );
    }

    // 3) Validate RAYA20 with subtotal=10 → ok=false, reason=min_subtotal.
    {
      const r = await call(jar, "POST", "/api/marketing/coupons/validate", {
        code: "RAYA20",
        subtotal_myr: 10,
      });
      const body = r.body as { ok?: boolean; reason?: string };
      record(
        3,
        "Validate RAYA20 + subtotal=10 → reason=min_subtotal",
        r.status === 200 && body.ok === false && body.reason === "min_subtotal",
        JSON.stringify(body),
      );
    }

    // 4) Redeem WELCOME10 for the customer.
    {
      const r = await call(jar, "POST", "/api/marketing/coupons/redeem", {
        code: "WELCOME10",
        customer_id: customerId,
        subtotal_myr: 25,
      });
      const body = r.body as {
        ok?: boolean;
        id?: string;
        discount_myr?: number;
      };
      const ok =
        (r.status === 201 || r.status === 200) &&
        body.ok === true &&
        typeof body.id === "string" &&
        body.discount_myr === 10;
      if (body.id) createdRedemptionIds.push(body.id);
      record(
        4,
        "Redeem WELCOME10 → records redemption",
        ok,
        JSON.stringify(body),
      );
    }

    // 5) Re-validate WELCOME10 as same customer → per_customer_limit_reached.
    {
      const r = await call(jar, "POST", "/api/marketing/coupons/validate", {
        code: "WELCOME10",
        customer_id: customerId,
        subtotal_myr: 25,
      });
      const body = r.body as { ok?: boolean; reason?: string };
      record(
        5,
        "Re-validate WELCOME10 same customer → per_customer_limit_reached",
        r.status === 200 &&
          body.ok === false &&
          body.reason === "per_customer_limit_reached",
        JSON.stringify(body),
      );
    }
  } finally {
    if (createdRedemptionIds.length > 0) {
      await admin
        .from("coupon_redemptions")
        .delete()
        .in("id", createdRedemptionIds);
      // Roll back the counter bump our redeem call applied so the demo
      // surface shows clean zeros.
      const { data: cnt } = await admin
        .from("coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", "20000000-0000-4000-8000-0000000000c2");
      // The select with head:true drops a request whose only purpose is
      // to materialise a count; we ignore the body. We then refresh the
      // cached counter directly to match the actual redemption count.
      void cnt;
      const { count: trueCount } = await admin
        .from("coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", "20000000-0000-4000-8000-0000000000c2");
      await admin
        .from("coupons")
        .update({ redeemed_count: trueCount ?? 0 })
        .eq("id", "20000000-0000-4000-8000-0000000000c2");
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n[smoke-coupons] ${results.length - failed.length}/${results.length} pass`,
  );
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(
    "[smoke-coupons] failed:",
    err instanceof Error ? err.message : err,
  );
  process.exitCode = 1;
});
