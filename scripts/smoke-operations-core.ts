/**
 * Operations core smoke test — order → done → product → booking → export.
 *
 * Usage: npm run smoke:operations
 * Requires: npm run dev + .env.local with Supabase keys.
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

if (!SUPABASE_URL || !SUPABASE_ANON || !SUPABASE_SERVICE) {
  console.error("[smoke-operations] Missing Supabase env vars in .env.local.");
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
  if (error) throw new Error(`signIn failed: ${error.message}`);
  await client.auth.getSession();
  if (jar.getAll().length === 0) {
    throw new Error("signIn returned no session cookies");
  }
  return jar;
}

async function call(
  jar: CookieJar,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown; raw: string }> {
  const headers: Record<string, string> = { Accept: "application/json" };
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
    /* keep text */
  }
  return { status: res.status, body: parsed, raw };
}

let passed = 0;
let failed = 0;

function ok(label: string) {
  passed++;
  console.log(`  ✓ ${label}`);
}

function fail(label: string, detail?: string) {
  failed++;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("\nOperations core smoke test\n");

  let jar: CookieJar;
  try {
    jar = await signIn(EMAIL, PASSWORD);
    ok("sign in");
  } catch (e) {
    fail("sign in", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const { data: userRow } = await admin
    .from("users")
    .select("business_id")
    .eq("email", EMAIL)
    .maybeSingle();
  const businessId = userRow?.business_id as string | undefined;
  if (!businessId) {
    fail("resolve business_id");
    process.exit(1);
  }
  ok("resolve business");

  const stamp = Date.now();
  const orderRes = await call(jar, "POST", "/api/operations/orders", {
    customer_name: `Smoke Customer ${stamp}`,
    title: `Smoke order ${stamp}`,
    status: "todo",
  });
  const orderJson = orderRes.body as { ok?: boolean; data?: { id: string } };
  const orderId = orderJson.data?.id;
  if (orderRes.status === 201 && orderJson.ok && orderId) {
    ok("create order");
  } else {
    fail("create order", `status=${orderRes.status}`);
    process.exit(1);
  }

  const doneRes = await call(jar, "PATCH", `/api/operations/orders/${orderId}`, {
    status: "done",
  });
  const doneJson = doneRes.body as { ok?: boolean };
  if (doneRes.status === 200 && doneJson.ok) {
    ok("mark order done");
  } else {
    fail("mark order done", `status=${doneRes.status}`);
  }

  const sku = `SMK-${String(stamp).slice(-6)}`;
  const productRes = await call(jar, "POST", "/api/operations/products", {
    sku,
    name: `Smoke product ${stamp}`,
    price_myr: 25,
    stock_qty: 2,
    low_stock_threshold: 5,
  });
  const productJson = productRes.body as { ok?: boolean };
  if (productRes.status === 201 && productJson.ok) {
    ok("create low-stock product");
  } else {
    fail("create low-stock product", `status=${productRes.status}`);
  }

  const start = new Date(Date.now() + 86400000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 3600000);
  const bookingRes = await call(jar, "POST", "/api/operations/bookings", {
    customer_name: `Smoke Customer ${stamp}`,
    service_title: "Smoke service",
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    status: "confirmed",
  });
  const bookingJson = bookingRes.body as { ok?: boolean };
  if (bookingRes.status === 201 && bookingJson.ok) {
    ok("create booking");
  } else {
    fail("create booking", `status=${bookingRes.status}`);
  }

  const exportRes = await fetch(`${APP_URL}/api/operations/export`, {
    headers: { Cookie: jar.toHeader(), Accept: "text/csv" },
  });
  const exportBody = await exportRes.text();
  if (
    exportRes.status === 200 &&
    exportRes.headers.get("content-type")?.includes("text/csv") &&
    exportBody.length > 10
  ) {
    ok("export CSV");
  } else {
    fail("export CSV", `status=${exportRes.status}`);
  }

  const { count: notifCount } = await admin
    .from("business_notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("pillar", "operations")
    .gte("created_at", new Date(Date.now() - 120_000).toISOString());

  if ((notifCount ?? 0) >= 3) {
    ok("operations notifications posted");
  } else {
    fail("operations notifications posted", `count=${notifCount ?? 0}`);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
