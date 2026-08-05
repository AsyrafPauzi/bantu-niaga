/**
 * Finance core smoke test — expense → invoice → share → export.
 *
 * Usage: npm run smoke:finance
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
  console.error("[smoke-finance] Missing Supabase env vars in .env.local.");
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
): Promise<{ status: number; body: unknown; raw: string; headers: Headers }> {
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
  return { status: res.status, body: parsed, raw, headers: res.headers };
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

function currentMonthYm(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  console.log("\nFinance core smoke test\n");

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
  ok("resolve business");

  const { data: business } = await admin
    .from("businesses")
    .select("idcompany")
    .eq("id", businessId)
    .maybeSingle();
  const idcompany = business?.idcompany as string | undefined;
  if (!idcompany) {
    fail("resolve idcompany");
    process.exit(1);
  }
  ok("resolve idcompany");

  const stamp = Date.now();
  const txnRes = await call(jar, "POST", "/api/finance/transactions", {
    kind: "expense",
    amount_myr: 12.5,
    description: `Smoke expense ${stamp}`,
    category: "office_supplies",
    txn_date: new Date().toISOString().slice(0, 10),
  });
  const txnJson = txnRes.body as { ok?: boolean; data?: { id: string } };
  if (txnRes.status === 201 && txnJson.ok && txnJson.data?.id) {
    ok("log expense");
  } else {
    fail("log expense", `status=${txnRes.status}`);
  }

  const invoiceRes = await call(jar, "POST", "/api/finance/invoices", {
    customer_name: `Smoke Customer ${stamp}`,
    customer_email: `smoke+${stamp}@example.com`,
    status: "sent",
    items: [
      {
        description: "Smoke test line",
        unit_price: 100,
        quantity: 1,
        taxable: false,
      },
    ],
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  });
  const invoiceJson = invoiceRes.body as {
    ok?: boolean;
    data?: { id: string; share_hash: string; number: string };
  };
  const invoiceId = invoiceJson.data?.id;
  const shareHash = invoiceJson.data?.share_hash;
  if (invoiceRes.status === 201 && invoiceJson.ok && invoiceId && shareHash) {
    ok("create sent invoice");
  } else {
    fail("create sent invoice", `status=${invoiceRes.status}`);
    process.exit(1);
  }

  const shareRes = await fetch(`${APP_URL}/${idcompany}/inv-${shareHash}`, {
    headers: { Accept: "text/html" },
  });
  const shareHtml = await shareRes.text();
  if (shareRes.status === 200 && shareHtml.includes(invoiceJson.data!.number)) {
    ok("public share link loads");
  } else {
    fail("public share link loads", `status=${shareRes.status}`);
  }

  const month = currentMonthYm();
  const exportRes = await fetch(
    `${APP_URL}/api/finance/export-pack?month=${month}`,
    { headers: { Cookie: jar.toHeader(), Accept: "text/csv" } },
  );
  const exportBody = await exportRes.text();
  if (
    exportRes.status === 200 &&
    exportRes.headers.get("content-type")?.includes("text/csv") &&
    exportBody.includes("date")
  ) {
    ok("accountant export CSV");
  } else {
    fail("accountant export CSV", `status=${exportRes.status}`);
  }

  const { count: notifCount } = await admin
    .from("business_notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("pillar", "finance")
    .gte("created_at", new Date(Date.now() - 120_000).toISOString());

  if ((notifCount ?? 0) >= 2) {
    ok("finance notifications posted");
  } else {
    fail("finance notifications posted", `count=${notifCount ?? 0}`);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
