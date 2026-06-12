/**
 * Bantu Niaga — Marketing M6 end-to-end smoke test.
 *
 * Runs against the locally-running `npm run dev` server (default
 * http://localhost:3000) and the remote Supabase project configured
 * in `.env.local`.
 *
 * Drives the M6 cross-pillar metric listener + KPI landing page
 * end-to-end with SYNTHETIC events_outbox rows because the upstream
 * Finance / Operations / Sales pillars (D1–D4 in
 * `marketing-implementation-plan.md` §3.3) are not yet built:
 *
 *   1. Sign in as the seeded owner.
 *   2. POST /api/marketing/customers — create a smoke customer.
 *   3. Insert one events_outbox row per supported event name pointing
 *      at the smoke customer (via service-role).
 *   4. Run `marketing_apply_metric_events_batch` (mirrors what
 *      `npm run backfill:marketing-events` does).
 *   5. Assert customer metrics updated correctly.
 *   6. Assert marketing_event_dedup contains the 4 events with
 *      outcome=applied.
 *   7. Run the batch again; assert idempotency.
 *   8. GET /marketing — assert page renders (the KPI numbers reflect
 *      the seed at least via total_customers / new_this_month).
 *
 * Cleans up customer + outbox + dedup rows in `finally`.
 *
 * Usage:
 *   npm run smoke:m6
 *
 * Env overrides (mirroring smoke-m4 / smoke-m5):
 *   APP_URL                   — default http://localhost:3000
 *   SEED_OWNER_EMAIL          — default owner@demo.bantuniaga.local
 *   SEED_OWNER_PASSWORD       — default DemoPassword!2026
 *   SMOKE_BUSINESS_ID         — default 11111111-1111-1111-1111-111111111111
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

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
    "[smoke-m6] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local.",
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

interface Result {
  group: string;
  id: string | number;
  title: string;
  status: "PASS" | "FAIL";
  detail?: string;
}
const results: Result[] = [];
function record(
  group: string,
  id: string | number,
  title: string,
  ok: boolean,
  detail?: string,
) {
  results.push({
    group,
    id,
    title,
    status: ok ? "PASS" : "FAIL",
    detail,
  });
  const tag = ok ? "PASS" : "FAIL";
  console.log(
    `[${tag}] ${group} #${id} — ${title}${detail ? `\n        ${detail}` : ""}`,
  );
}

function pickPreview(value: unknown, maxLen = 240): string {
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

async function call(
  jar: CookieJar,
  method: string,
  path: string,
  init?: { body?: BodyInit; headers?: Record<string, string> },
): Promise<{ status: number; body: unknown; raw: string }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init?.headers ?? {}),
  };
  const cookieHeader = jar.toHeader();
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  if (
    init?.body &&
    !(init.body instanceof FormData) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${APP_URL}${path}`, {
    method,
    headers,
    body: init?.body,
  });
  const raw = await res.text();
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* leave as text */
  }
  return { status: res.status, body: parsed, raw };
}

interface BatchRow {
  event_id: string;
  event_name: string;
  outcome: string;
  applied: boolean;
  error_message: string | null;
}

const SMOKE_PHONE = "+60161110600";
const SMOKE_NAME = "M6 Smoke Customer";

async function preClean(admin: SupabaseClient): Promise<void> {
  // Drop any leftover smoke rows from previous failed runs. Identify
  // by the smoke phone number — unique per smoke fixture.
  const { data } = await admin
    .from("customers")
    .select("id")
    .eq("business_id", BUSINESS_ID)
    .eq("phone_e164", SMOKE_PHONE);
  const ids = (data ?? []).map((d) => d.id as string);
  if (ids.length > 0) {
    // events_outbox rows tagged via payload.customer_id reference.
    // Find all outbox rows whose payload mentions any of these ids and
    // sweep dedup + outbox.
    const { data: eventRows } = await admin
      .from("events_outbox")
      .select("id, payload")
      .eq("business_id", BUSINESS_ID)
      .in("name", [
        "invoice.paid",
        "order.delivered",
        "booking.completed",
        "lead.converted",
        "customer.updated",
      ]);
    const matches = (eventRows ?? [])
      .filter((row) => {
        const payload = (row as { payload: Record<string, unknown> }).payload ?? {};
        const cid = typeof payload.customer_id === "string"
          ? (payload.customer_id as string)
          : null;
        return cid != null && ids.includes(cid);
      })
      .map((r) => (r as { id: string }).id);
    if (matches.length > 0) {
      await admin
        .from("marketing_event_dedup")
        .delete()
        .in("event_id", matches);
      await admin.from("events_outbox").delete().in("id", matches);
    }
    await admin.from("customers").delete().in("id", ids);
  }
}

async function postCleanup(
  admin: SupabaseClient,
  customerId: string | null,
  eventIds: string[],
): Promise<void> {
  if (eventIds.length > 0) {
    await admin
      .from("marketing_event_dedup")
      .delete()
      .in("event_id", eventIds);
    await admin.from("events_outbox").delete().in("id", eventIds);
  }
  if (customerId) {
    // Sweep customer.updated outbox rows we generated for this customer.
    const { data: rows } = await admin
      .from("events_outbox")
      .select("id, payload")
      .eq("business_id", BUSINESS_ID)
      .eq("name", "customer.updated");
    const ids = (rows ?? [])
      .filter((row) => {
        const payload = (row as { payload: Record<string, unknown> }).payload ?? {};
        return payload.customer_id === customerId;
      })
      .map((r) => (r as { id: string }).id);
    if (ids.length > 0) {
      await admin.from("events_outbox").delete().in("id", ids);
    }
    await admin.from("customers").delete().eq("id", customerId);
  }
}

async function main() {
  console.log(`[smoke-m6] APP_URL=${APP_URL}`);
  console.log(`[smoke-m6] SEED_EMAIL=${SEED_EMAIL}`);

  try {
    const head = await fetch(`${APP_URL}/sign-in`);
    if (head.status !== 200) throw new Error(`HEAD /sign-in returned ${head.status}`);
  } catch (e) {
    console.error(
      `[smoke-m6] FATAL — dev server unreachable at ${APP_URL}: ${
        e instanceof Error ? e.message : e
      }`,
    );
    process.exit(2);
  }

  const owner = await signIn(SEED_EMAIL, SEED_PASSWORD);
  console.log(`[smoke-m6] signed in as owner`);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  await preClean(admin);

  let customerId: string | null = null;
  const eventIds: string[] = [];

  try {
    // ── 1. Create the smoke customer. ───────────────────────────────────
    {
      const r = await call(owner, "POST", "/api/marketing/customers", {
        body: JSON.stringify({
          name: SMOKE_NAME,
          phone: SMOKE_PHONE,
          source: "manual",
        }),
      });
      const body = r.body as { action?: string; customer_id?: string };
      const ok = r.status === 201 && body?.action === "created" && !!body.customer_id;
      record(
        "create",
        1,
        "POST /api/marketing/customers (smoke customer)",
        ok,
        ok
          ? `id=${body.customer_id}`
          : `status=${r.status} body=${pickPreview(r.body)}`,
      );
      if (!ok || !body.customer_id) {
        finishAndExit();
        return;
      }
      customerId = body.customer_id;
    }

    // ── 2. Insert synthetic outbox rows. ────────────────────────────────
    const invoiceId = randomUUID();
    const now = new Date();
    const paidAt = new Date(now.getTime() - 4 * 86_400_000).toISOString();
    const deliveredAt = new Date(now.getTime() - 3 * 86_400_000).toISOString();
    const completedAt = new Date(now.getTime() - 2 * 86_400_000).toISOString();
    const convertedAt = new Date(now.getTime() - 86_400_000).toISOString();

    const synthetics: Array<{ name: string; payload: Record<string, unknown> }> = [
      {
        name: "invoice.paid",
        payload: {
          invoice_id: invoiceId,
          invoice_number: "INV-SMOKE-001",
          customer_id: customerId,
          business_id: BUSINESS_ID,
          total_myr: 200,
          payment_method: "duitnow_qr",
          paid_at: paidAt,
          line_items: [],
        },
      },
      {
        name: "order.delivered",
        payload: {
          order_id: randomUUID(),
          customer_id: customerId,
          invoice_id: null,
          business_id: BUSINESS_ID,
          total_myr: 75,
          delivered_at: deliveredAt,
          line_items: [],
        },
      },
      {
        name: "booking.completed",
        payload: {
          booking_id: randomUUID(),
          customer_id: customerId,
          invoice_id: null,
          business_id: BUSINESS_ID,
          service_total_myr: 50,
          completed_at: completedAt,
        },
      },
      {
        name: "lead.converted",
        payload: {
          lead_id: randomUUID(),
          customer_id: customerId,
          business_id: BUSINESS_ID,
          name: SMOKE_NAME,
          phone_e164: SMOKE_PHONE,
          email: null,
          note: null,
          converted_at: convertedAt,
        },
      },
    ];

    for (const s of synthetics) {
      const id = randomUUID();
      const { error } = await admin.from("events_outbox").insert({
        id,
        business_id: BUSINESS_ID,
        name: s.name,
        payload: s.payload,
      });
      record(
        "outbox",
        s.name,
        `insert synthetic events_outbox row (${s.name})`,
        !error,
        error?.message,
      );
      if (error) {
        finishAndExit();
        return;
      }
      eventIds.push(id);
    }

    // ── 3. Run the batch RPC. ───────────────────────────────────────────
    {
      const { data, error } = await admin.rpc(
        "marketing_apply_metric_events_batch",
        { p_limit: 100 },
      );
      const rows = (data ?? []) as BatchRow[];
      const targeted = rows.filter((r) => eventIds.includes(r.event_id));
      const appliedCount = targeted.filter((r) => r.outcome === "applied").length;
      const ok = !error && targeted.length === 4 && appliedCount === 4;
      record(
        "rpc",
        1,
        "marketing_apply_metric_events_batch (first run)",
        ok,
        ok
          ? `processed=${rows.length} applied(our 4)=${appliedCount}`
          : error
            ? error.message
            : `targeted=${targeted.length} applied=${appliedCount} all=${JSON.stringify(targeted.map((r) => ({ n: r.event_name, o: r.outcome })))}`,
      );
      if (!ok) {
        finishAndExit();
        return;
      }
    }

    // ── 4. Verify metric mutation. ─────────────────────────────────────
    const expectedSpend = 200 + 75 + 50; // invoice.paid + order.delivered + booking.completed; lead is no-op
    const expectedOrders = 3;
    {
      const { data, error } = await admin
        .from("customers")
        .select("total_spend_myr, order_count, last_purchase_at")
        .eq("id", customerId)
        .single();
      const row = data as
        | {
            total_spend_myr: number | string;
            order_count: number;
            last_purchase_at: string | null;
          }
        | null;
      const observed = Number(row?.total_spend_myr ?? 0);
      const ok =
        !error &&
        row != null &&
        Math.abs(observed - expectedSpend) < 0.005 &&
        row.order_count === expectedOrders &&
        row.last_purchase_at != null;
      record(
        "metrics",
        1,
        "customer metrics reflect 3 monetary events",
        ok,
        ok
          ? `total_spend_myr=${observed} order_count=${row?.order_count} last_purchase_at=${row?.last_purchase_at}`
          : error
            ? error.message
            : `expected total_spend=${expectedSpend}, order_count=${expectedOrders}; observed=${JSON.stringify(row)}`,
      );
    }

    // ── 5. Verify dedup populated. ─────────────────────────────────────
    {
      const { data, error } = await admin
        .from("marketing_event_dedup")
        .select("event_id, outcome")
        .in("event_id", eventIds);
      const rows = (data ?? []) as Array<{ event_id: string; outcome: string | null }>;
      const ok =
        !error && rows.length === 4 && rows.every((r) => r.outcome === "applied");
      record(
        "dedup",
        1,
        "marketing_event_dedup has 4 applied rows",
        ok,
        ok
          ? `count=${rows.length}`
          : error
            ? error.message
            : `rows=${JSON.stringify(rows)}`,
      );
    }

    // ── 6. Idempotency: second batch is a no-op for our events. ────────
    {
      const { data, error } = await admin.rpc(
        "marketing_apply_metric_events_batch",
        { p_limit: 100 },
      );
      const rows = (data ?? []) as BatchRow[];
      const ourEvents = rows.filter((r) => eventIds.includes(r.event_id));
      const ok = !error && ourEvents.length === 0;
      record(
        "idempotency",
        1,
        "second batch sees zero new events for the smoke set",
        ok,
        ok
          ? `total_processed=${rows.length} our_events=${ourEvents.length}`
          : error
            ? error.message
            : `our_events still present: ${JSON.stringify(ourEvents)}`,
      );
    }

    // ── 7. Metric stability after second run. ─────────────────────────
    {
      const { data, error } = await admin
        .from("customers")
        .select("total_spend_myr, order_count")
        .eq("id", customerId)
        .single();
      const row = data as
        | { total_spend_myr: number | string; order_count: number }
        | null;
      const observed = Number(row?.total_spend_myr ?? 0);
      const ok =
        !error &&
        row != null &&
        Math.abs(observed - expectedSpend) < 0.005 &&
        row.order_count === expectedOrders;
      record(
        "idempotency",
        2,
        "customer metrics unchanged after second batch",
        ok,
        ok
          ? `total_spend_myr=${observed} order_count=${row?.order_count}`
          : `observed=${JSON.stringify(row)}`,
      );
    }

    // ── 8. KPI snapshot RPC reflects the seed. ─────────────────────────
    {
      const { data, error } = await admin.rpc("marketing_kpi_snapshot", {
        p_business_id: BUSINESS_ID,
      });
      const raw = Array.isArray(data) ? data[0] : data;
      const total = Number(
        (raw as { total_customers?: number | string })?.total_customers ?? 0,
      );
      const ok = !error && total >= 1;
      record(
        "kpi",
        1,
        "marketing_kpi_snapshot returns at least 1 customer (the smoke one)",
        ok,
        ok
          ? `total_customers=${total}`
          : error
            ? error.message
            : `raw=${JSON.stringify(raw)}`,
      );
    }

    // ── 9. /marketing landing renders. ─────────────────────────────────
    {
      const res = await fetch(`${APP_URL}/marketing`, {
        method: "GET",
        headers: { Cookie: owner.toHeader() },
      });
      const text = await res.text();
      const ok =
        res.status === 200 &&
        text.includes("Total customers") &&
        text.includes("New this month") &&
        text.includes("VIPs") &&
        text.includes("Dormant") &&
        text.includes("At-risk");
      record(
        "ui",
        1,
        "GET /marketing renders all 5 KPI cards",
        ok,
        ok
          ? `status=${res.status} length=${text.length}`
          : `status=${res.status} preview=${text.slice(0, 240)}`,
      );
    }
  } finally {
    await postCleanup(admin, customerId, eventIds).catch((e) => {
      console.warn(
        `[smoke-m6] cleanup failed: ${e instanceof Error ? e.message : e}`,
      );
    });
  }

  finishAndExit();
}

function finishAndExit(): never {
  const passes = results.filter((r) => r.status === "PASS").length;
  const fails = results.filter((r) => r.status === "FAIL").length;
  console.log("");
  console.log(`[smoke-m6] PASS=${passes} FAIL=${fails} (total=${results.length})`);
  if (fails > 0) {
    console.log("");
    console.log("FAILS:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  - [${r.group} #${r.id}] ${r.title} :: ${r.detail ?? ""}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(
    "[smoke-m6] fatal:",
    e instanceof Error ? e.stack ?? e.message : e,
  );
  process.exit(2);
});
