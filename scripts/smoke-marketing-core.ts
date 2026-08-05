/**
 * Marketing core smoke — customer + coupon + notifications.
 * Usage: npm run smoke:marketing
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
const EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@demo.bantuniaga.local";
const PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "DemoPassword!2026";

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

async function signIn(): Promise<CookieJar> {
  const jar = new CookieJar();
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items: CookieEntry[]) => jar.setAll(items),
    },
  });
  const { error } = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error) throw new Error(error.message);
  await client.auth.getSession();
  return jar;
}

async function call(jar: CookieJar, method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { Accept: "application/json" };
  const cookie = jar.toHeader();
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${APP_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* text */
  }
  return { status: res.status, body: parsed };
}

let passed = 0;
let failed = 0;
function ok(l: string) {
  passed++;
  console.log(`  ✓ ${l}`);
}
function fail(l: string, d?: string) {
  failed++;
  console.error(`  ✗ ${l}${d ? ` — ${d}` : ""}`);
}

async function main() {
  console.log("\nMarketing core smoke test\n");
  const jar = await signIn();
  ok("sign in");

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const { data: userRow } = await admin
    .from("users")
    .select("business_id")
    .eq("email", EMAIL)
    .maybeSingle();
  const businessId = userRow?.business_id as string | undefined;
  if (!businessId) {
    fail("business_id");
    process.exit(1);
  }

  const stamp = Date.now();
  const cust = await call(jar, "POST", "/api/marketing/customers", {
    name: `Smoke Customer ${stamp}`,
    phone: `+6019${String(stamp).slice(-8)}`,
    source: "manual",
    force_create: true,
  });
  if (cust.status === 201) ok("create customer");
  else fail("create customer", `status=${cust.status}`);

  const coupon = await call(jar, "POST", "/api/marketing/coupons", {
    type: "PCT",
    value: 10,
  });
  if (coupon.status === 201) ok("create coupon");
  else fail("create coupon", `status=${coupon.status}`);

  const { count } = await admin
    .from("business_notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("pillar", "marketing")
    .gte("created_at", new Date(Date.now() - 120_000).toISOString());

  if ((count ?? 0) >= 2) ok("marketing notifications");
  else fail("marketing notifications", `count=${count ?? 0}`);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
