/**
 * Sales core smoke test — lead → POS → receipt → void → export.
 *
 * Usage: npm run smoke:sales
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
  console.error("[smoke-sales] Missing Supabase env vars in .env.local.");
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
): Promise<{ status: number; body: unknown; headers: Headers }> {
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
    /* keep as text */
  }
  return { status: res.status, body: parsed, headers: res.headers };
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
  console.log("\nSales smoke test\n");

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
    .select("id, business_id")
    .eq("email", EMAIL)
    .maybeSingle();
  const businessId = userRow?.business_id as string | undefined;
  if (!businessId) {
    fail("resolve business_id");
    process.exit(1);
  }

  const leadPhone = `+6019${String(Date.now()).slice(-8)}`;
  const leadRes = await call(jar, "POST", "/api/sales/leads", {
    name: "Smoke Test Lead",
    phone: leadPhone,
    channel: "walk_in",
    status: "interested",
  });
  const leadJson = leadRes.body as { data?: { id: string } };
  if (leadRes.status !== 201 || !leadJson.data?.id) {
    fail("create lead", `status ${leadRes.status}`);
    process.exit(1);
  }
  const leadId = leadJson.data.id;
  ok("create lead");

  const prodRes = await call(jar, "GET", "/api/sales/pos/products");
  const prodJson = prodRes.body as { data?: Array<{ id: string }> };
  const productId = prodJson.data?.[0]?.id;
  if (!productId) {
    fail("load products", "no active products");
    process.exit(1);
  }
  ok("load products");

  const checkoutRes = await call(jar, "POST", "/api/sales/pos/checkout", {
    items: [{ product_id: productId, quantity: 1 }],
    payment_method: "cash",
    payment_received_myr: 100,
    customer_name: "Smoke Test Lead",
  });
  const checkoutJson = checkoutRes.body as {
    data?: { sale?: { id: string; sale_number: string } };
    error?: string;
  };
  const saleId = checkoutJson.data?.sale?.id;
  if (checkoutRes.status !== 201 || !saleId) {
    fail("POS checkout", checkoutJson.error ?? `status ${checkoutRes.status}`);
    process.exit(1);
  }
  ok("POS checkout");

  const { data: outbox } = await admin
    .from("events_outbox")
    .select("id, name, dispatched_at")
    .eq("business_id", businessId)
    .eq("name", "sale.completed")
    .order("emitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!outbox?.dispatched_at) {
    fail("sale.completed event dispatched");
  } else {
    ok("sale.completed event dispatched");
  }

  const receiptRes = await fetch(`${APP_URL}/sales/receipts/${saleId}`, {
    headers: { Cookie: jar.toHeader() },
  });
  if (receiptRes.status !== 200) fail("receipt page", `status ${receiptRes.status}`);
  else ok("receipt page");

  const voidRes = await call(jar, "POST", `/api/sales/pos/sales/${saleId}/void`, {
    reason: "smoke test void",
  });
  if (voidRes.status !== 200) {
    fail("void sale", `status ${voidRes.status}`);
  } else {
    ok("void sale");
  }

  const exportRes = await fetch(`${APP_URL}/api/sales/pos/export?period=today`, {
    headers: { Cookie: jar.toHeader() },
  });
  if (!exportRes.ok || !exportRes.headers.get("content-type")?.includes("text/csv")) {
    fail("export CSV", `status ${exportRes.status}`);
  } else {
    ok("export CSV");
  }

  await admin.from("sales_leads").delete().eq("id", leadId);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
