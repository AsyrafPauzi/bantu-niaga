/**
 * Bantu Niaga — Marketing M2 end-to-end smoke test.
 *
 * Runs against the locally-running `npm run dev` server (default
 * http://localhost:3000) and the remote Supabase project configured in
 * `.env.local`.
 *
 * It signs in as the seed owner (and optionally a freshly-minted cashier
 * for RBAC negative checks), then drives every M2 surface:
 *
 *   1. POST   /api/marketing/customers           (create / dedup-merge / prompt / force-create)
 *   2. GET    /api/marketing/customers           (list, filter, sort)
 *   3. GET    /api/marketing/customers/[id]
 *   4. PATCH  /api/marketing/customers/[id]      (desktop default + mobile whitelist)
 *   5. GET    /api/marketing/customers/search
 *   6. POST   /api/marketing/customers/[id]/merge
 *   7. DELETE /api/marketing/customers/[id]
 *   8. RBAC   negative checks for `cashier`
 *   9. Page renders for every M2 route + companions (sign-in, home, settings).
 *
 * Idempotent. Re-runs cleanup their own customers via tombstone +
 * service-role hard-delete in `finally`.
 *
 * Usage:
 *   npm run smoke:m2
 *
 * Env overrides:
 *   APP_URL                       — default http://localhost:3000
 *   SEED_OWNER_EMAIL              — default owner@demo.bantuniaga.local
 *   SEED_OWNER_PASSWORD           — default DemoPassword!2026
 *   SMOKE_CASHIER_EMAIL           — default cashier-smoke@demo.bantuniaga.local
 *   SMOKE_CASHIER_PASSWORD        — default DemoPassword!2026
 *   SMOKE_BUSINESS_ID             — default 11111111-1111-1111-1111-111111111111
 *   SMOKE_KEEP_USERS              — if set, don't delete the cashier on teardown
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// ─────────────────────────────────────────────────────────────────────────
// Env loader (matches scripts/seed-owner.ts so we don't add a dotenv dep).
// ─────────────────────────────────────────────────────────────────────────
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
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
loadDotEnvLocal();

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SEED_EMAIL =
  process.env.SEED_OWNER_EMAIL ?? "owner@demo.bantuniaga.local";
const SEED_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "DemoPassword!2026";
const CASHIER_EMAIL =
  process.env.SMOKE_CASHIER_EMAIL ?? "cashier-smoke@demo.bantuniaga.local";
const CASHIER_PASSWORD =
  process.env.SMOKE_CASHIER_PASSWORD ?? "DemoPassword!2026";
const BUSINESS_ID =
  process.env.SMOKE_BUSINESS_ID ?? "11111111-1111-1111-1111-111111111111";

if (!SUPABASE_URL || !SUPABASE_ANON || !SUPABASE_SERVICE) {
  console.error(
    "[smoke] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────────
// Cookie jar built on top of `@supabase/ssr`. We use createServerClient
// with an in-memory Map so we can intercept the session cookies the
// helper writes when signInWithPassword succeeds, then replay them as a
// Cookie header against the running Next.js dev server.
// ─────────────────────────────────────────────────────────────────────────
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
      if (item.value === "") {
        this.store.delete(item.name);
      } else {
        this.store.set(item.name, item);
      }
    }
  }
  toHeader(): string {
    return this.getAll()
      .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
      .join("; ");
  }
  clear() {
    this.store.clear();
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
  if (error) {
    throw new Error(`signIn(${email}) failed: ${error.message}`);
  }
  // signIn writes the session cookie, but we make sure getSession runs
  // once so the cookie chunks are finalised before we replay them.
  await client.auth.getSession();
  if (jar.getAll().length === 0) {
    throw new Error(`signIn(${email}) returned no session cookies`);
  }
  return jar;
}

// ─────────────────────────────────────────────────────────────────────────
// Result tracking.
// ─────────────────────────────────────────────────────────────────────────
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
  const line = `[${tag}] ${group} #${id} — ${title}${
    detail ? `\n        ${detail}` : ""
  }`;
  console.log(line);
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

// ─────────────────────────────────────────────────────────────────────────
// HTTP helpers.
// ─────────────────────────────────────────────────────────────────────────
async function call(
  jar: CookieJar,
  method: string,
  path: string,
  init?: { body?: unknown; headers?: Record<string, string> },
): Promise<{ status: number; body: unknown; raw: string }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init?.headers ?? {}),
  };
  let body: BodyInit | undefined;
  if (init?.body !== undefined) {
    headers["Content-Type"] ??= "application/json";
    body = JSON.stringify(init.body);
  }
  const cookieHeader = jar.toHeader();
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  const res = await fetch(`${APP_URL}${path}`, { method, headers, body });
  const raw = await res.text();
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* leave as text */
  }
  return { status: res.status, body: parsed, raw };
}

async function fetchPage(
  jar: CookieJar,
  path: string,
): Promise<{ status: number; html: string }> {
  const headers: Record<string, string> = { Accept: "text/html" };
  const cookieHeader = jar.toHeader();
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  const res = await fetch(`${APP_URL}${path}`, { headers, redirect: "manual" });
  const html = await res.text();
  return { status: res.status, html };
}

// ─────────────────────────────────────────────────────────────────────────
// RBAC fixture — create a cashier in the same business so we can prove
// the M2 endpoints actually reject non-Marketing roles.
// ─────────────────────────────────────────────────────────────────────────
async function ensureCashier(): Promise<string | null> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Find existing.
  let userId: string | null = null;
  let page = 1;
  while (page <= 5) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === CASHIER_EMAIL.toLowerCase(),
    );
    if (hit) {
      userId = hit.id;
      break;
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: CASHIER_EMAIL,
      password: CASHIER_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user?.id ?? null;
    if (!userId) throw new Error("admin.createUser returned no id");
  } else {
    await admin.auth.admin.updateUserById(userId, {
      password: CASHIER_PASSWORD,
      email_confirm: true,
    });
  }
  // Upsert public.users row.
  const { error: upErr } = await admin.from("users").upsert(
    {
      id: userId,
      business_id: BUSINESS_ID,
      role: "cashier",
      display_name: "Smoke Cashier",
      email: CASHIER_EMAIL,
    },
    { onConflict: "id" },
  );
  if (upErr) throw upErr;
  return userId;
}

async function deleteCashier(userId: string): Promise<void> {
  if (process.env.SMOKE_KEEP_USERS) return;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from("users").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);
}

// Hard-delete the smoke customers we created so reruns don't leave
// orphans in the database. Service-role bypasses RLS.
async function hardCleanupCustomers(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Delete dependent rows first.
  await admin.from("customer_tag_history").delete().in("customer_id", ids);
  // Outbox rows are append-only audit; leave them. They also do not have
  // a FK to customers.
  await admin.from("customers").delete().in("id", ids);
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 2 — driver.
// ─────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[smoke] APP_URL=${APP_URL}`);
  console.log(`[smoke] SEED_EMAIL=${SEED_EMAIL}`);

  // Confirm dev server is up.
  try {
    const head = await fetch(`${APP_URL}/sign-in`);
    if (head.status !== 200) {
      throw new Error(`HEAD /sign-in returned ${head.status}`);
    }
  } catch (e) {
    console.error(
      `[smoke] FATAL — dev server unreachable at ${APP_URL}: ${
        e instanceof Error ? e.message : e
      }`,
    );
    process.exit(2);
  }

  const owner = await signIn(SEED_EMAIL, SEED_PASSWORD);
  console.log(`[smoke] signed in as owner (cookies: ${owner.getAll().length})`);

  // Pre-clean any leftover phone-clashing customers from a prior run.
  await preCleanByPhone(["+60123456789"]);

  const createdIds: string[] = [];
  let C1 = "";
  let C2 = "";

  try {
    // ── 1. Create customer ───────────────────────────────────────────
    {
      const r = await call(owner, "POST", "/api/marketing/customers", {
        body: { name: "Test Customer", phone: "012-345 6789" },
      });
      const body = r.body as {
        action?: string;
        customer_id?: string;
      };
      const ok =
        r.status === 201 &&
        body?.action === "created" &&
        typeof body?.customer_id === "string";
      record(
        "endpoint",
        1,
        "POST /customers create",
        ok,
        ok ? `id=${body.customer_id}` : `status=${r.status} body=${pickPreview(r.body)}`,
      );
      if (body?.customer_id) {
        C1 = body.customer_id;
        createdIds.push(C1);
      }
    }

    // ── 2. Dedup same-name same-phone → merged ───────────────────────
    {
      const r = await call(owner, "POST", "/api/marketing/customers", {
        body: { name: "Test Customer", phone: "012-345 6789" },
      });
      const body = r.body as { action?: string; customer_id?: string };
      const ok =
        (r.status === 200 || r.status === 201) &&
        body?.action === "merged" &&
        body?.customer_id === C1;
      record(
        "endpoint",
        2,
        "POST /customers dedup merge",
        ok,
        ok
          ? `merged → ${body.customer_id}`
          : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    }

    // ── 3. Different name same phone → prompt ────────────────────────
    {
      const r = await call(owner, "POST", "/api/marketing/customers", {
        body: { name: "Diff Name", phone: "012-345 6789" },
      });
      const body = r.body as {
        action?: string;
        existing_customer_id?: string;
      };
      const ok =
        r.status === 200 &&
        body?.action === "prompt" &&
        body?.existing_customer_id === C1;
      record(
        "endpoint",
        3,
        "POST /customers dedup prompt",
        ok,
        ok
          ? `prompt → existing ${body.existing_customer_id}`
          : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    }

    // ── 4. force_create true → new row ───────────────────────────────
    {
      const r = await call(owner, "POST", "/api/marketing/customers", {
        body: {
          name: "Diff Name",
          phone: "012-345 6789",
          force_create: true,
        },
      });
      const body = r.body as { action?: string; customer_id?: string };
      const ok =
        r.status === 201 &&
        body?.action === "created" &&
        typeof body?.customer_id === "string" &&
        body.customer_id !== C1;
      record(
        "endpoint",
        4,
        "POST /customers force_create",
        ok,
        ok
          ? `id=${body.customer_id}`
          : `status=${r.status} body=${pickPreview(r.body)}`,
      );
      if (body?.customer_id) {
        C2 = body.customer_id;
        createdIds.push(C2);
      }
    }

    // ── 5. List ──────────────────────────────────────────────────────
    {
      const r = await call(owner, "GET", "/api/marketing/customers");
      const body = r.body as {
        data?: Array<{ id: string }>;
        page?: number;
        pageSize?: number;
        total?: number;
      };
      const ids = (body?.data ?? []).map((d) => d.id);
      const ok =
        r.status === 200 &&
        Array.isArray(body?.data) &&
        typeof body?.page === "number" &&
        typeof body?.pageSize === "number" &&
        typeof body?.total === "number" &&
        ids.includes(C1) &&
        (!C2 || ids.includes(C2));
      record(
        "endpoint",
        5,
        "GET /customers list",
        ok,
        ok
          ? `total=${body.total} found C1=${ids.includes(C1)} C2=${C2 ? ids.includes(C2) : "n/a"}`
          : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    }

    // ── 6. List with ?q=Test ─────────────────────────────────────────
    {
      const r = await call(owner, "GET", "/api/marketing/customers?q=Test");
      const body = r.body as { data?: Array<{ id: string; name: string }> };
      const rows = body?.data ?? [];
      const ok =
        r.status === 200 &&
        rows.length > 0 &&
        rows.every((row) => /test/i.test(row.name));
      record(
        "endpoint",
        6,
        "GET /customers?q=Test",
        ok,
        ok
          ? `${rows.length} rows, all match`
          : `status=${r.status} preview=${pickPreview(r.body)}`,
      );
    }

    // ── 7. List sorted by name asc ──────────────────────────────────
    {
      const r = await call(
        owner,
        "GET",
        "/api/marketing/customers?sort=name&order=asc",
      );
      const body = r.body as { data?: Array<{ name: string }> };
      const names = (body?.data ?? []).map((d) => d.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      const ok =
        r.status === 200 && JSON.stringify(names) === JSON.stringify(sorted);
      record(
        "endpoint",
        7,
        "GET /customers sort=name asc",
        ok,
        ok ? `names=${pickPreview(names)}` : `status=${r.status} names=${pickPreview(names)}`,
      );
    }

    // ── 8. GET single C1 ─────────────────────────────────────────────
    if (C1) {
      const r = await call(owner, "GET", `/api/marketing/customers/${C1}`);
      const body = r.body as {
        customer?: { id?: string };
        tag_history?: unknown[];
      };
      const ok =
        r.status === 200 &&
        body?.customer?.id === C1 &&
        Array.isArray(body?.tag_history);
      record(
        "endpoint",
        8,
        "GET /customers/[id]",
        ok,
        ok
          ? `id=${body.customer?.id} tag_history=${body.tag_history?.length}`
          : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    } else {
      record("endpoint", 8, "GET /customers/[id]", false, "C1 missing");
    }

    // ── 9. PATCH default mode (desktop) — set notes ─────────────────
    if (C1) {
      const r = await call(owner, "PATCH", `/api/marketing/customers/${C1}`, {
        body: { notes: "VIP from desktop" },
      });
      const body = r.body as { action?: string; changed_fields?: string[] };
      const ok =
        r.status === 200 &&
        body?.action === "updated" &&
        Array.isArray(body.changed_fields) &&
        body.changed_fields.includes("notes");
      record(
        "endpoint",
        9,
        "PATCH /customers/[id] desktop notes",
        ok,
        ok
          ? `changed=${pickPreview(body.changed_fields)}`
          : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    } else {
      record("endpoint", 9, "PATCH /customers/[id]", false, "C1 missing");
    }

    // ── 10. PATCH mobile with name (not allowed) → 400 ──────────────
    if (C1) {
      const r = await call(owner, "PATCH", `/api/marketing/customers/${C1}`, {
        headers: { "X-Surface-Mode": "mobile" },
        body: { name: "NewName" },
      });
      const body = r.body as { error?: string };
      const ok = r.status === 400 && body?.error === "validation_failed";
      record(
        "endpoint",
        10,
        "PATCH /customers/[id] mobile rejects name",
        ok,
        ok
          ? `400 validation_failed`
          : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    } else {
      record("endpoint", 10, "PATCH /customers/[id] mobile reject", false, "C1 missing");
    }

    // ── 11. PATCH mobile notes (allowed) → 200 ──────────────────────
    if (C1) {
      const r = await call(owner, "PATCH", `/api/marketing/customers/${C1}`, {
        headers: { "X-Surface-Mode": "mobile" },
        body: { notes: "From mobile" },
      });
      const body = r.body as { action?: string; changed_fields?: string[] };
      const ok =
        r.status === 200 &&
        body?.action === "updated" &&
        body.changed_fields?.includes("notes") === true;
      record(
        "endpoint",
        11,
        "PATCH /customers/[id] mobile notes",
        ok,
        ok ? "200" : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    } else {
      record("endpoint", 11, "PATCH /customers/[id] mobile notes", false, "C1 missing");
    }

    // ── 12. /customers/search ───────────────────────────────────────
    {
      const r = await call(
        owner,
        "GET",
        "/api/marketing/customers/search?q=Test",
      );
      const body = r.body as {
        data?: Array<{ id: string; name: string; phone_e164?: string }>;
      };
      const rows = body?.data ?? [];
      const ok = r.status === 200 && rows.length > 0;
      record(
        "endpoint",
        12,
        "GET /customers/search",
        ok,
        ok
          ? `${rows.length} rows`
          : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    }

    // ── 13. Merge C2 into C1 ─────────────────────────────────────────
    if (C1 && C2) {
      const r = await call(
        owner,
        "POST",
        `/api/marketing/customers/${C1}/merge`,
        { body: { winner_id: C1, loser_id: C2 } },
      );
      const body = r.body as {
        action?: string;
        winner_id?: string;
        loser_id?: string;
      };
      const ok =
        r.status === 200 &&
        body?.action === "merged" &&
        body.winner_id === C1 &&
        body.loser_id === C2;
      record(
        "endpoint",
        13,
        "POST /customers/[id]/merge",
        ok,
        ok ? "200 merged" : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    } else {
      record("endpoint", 13, "POST /customers/[id]/merge", false, "ids missing");
    }

    // ── 14. Merge again → 409 already_merged ─────────────────────────
    if (C1 && C2) {
      const r = await call(
        owner,
        "POST",
        `/api/marketing/customers/${C1}/merge`,
        { body: { winner_id: C1, loser_id: C2 } },
      );
      const body = r.body as { error?: string };
      const ok = r.status === 409 && body?.error === "already_merged";
      record(
        "endpoint",
        14,
        "POST /customers/[id]/merge duplicate",
        ok,
        ok ? "409 already_merged" : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    } else {
      record("endpoint", 14, "POST /customers/[id]/merge dup", false, "ids missing");
    }

    // ── 15. DELETE C1 ────────────────────────────────────────────────
    if (C1) {
      const r = await call(
        owner,
        "DELETE",
        `/api/marketing/customers/${C1}`,
      );
      const body = r.body as { action?: string; deleted_at?: string | null };
      const ok =
        r.status === 200 &&
        body?.action === "deleted" &&
        typeof body?.deleted_at === "string";
      record(
        "endpoint",
        15,
        "DELETE /customers/[id]",
        ok,
        ok ? `deleted_at=${body.deleted_at}` : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    } else {
      record("endpoint", 15, "DELETE /customers/[id]", false, "C1 missing");
    }

    // ── 16. GET deleted customer → 404 ──────────────────────────────
    if (C1) {
      const r = await call(owner, "GET", `/api/marketing/customers/${C1}`);
      const body = r.body as { error?: string };
      const ok = r.status === 404 && body?.error === "not_found";
      record(
        "endpoint",
        16,
        "GET /customers/[id] after delete",
        ok,
        ok ? "404" : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    } else {
      record("endpoint", 16, "GET /customers/[id] after delete", false, "C1 missing");
    }

    // ── 17. List after delete excludes C1 ───────────────────────────
    {
      const r = await call(owner, "GET", "/api/marketing/customers");
      const body = r.body as { data?: Array<{ id: string }> };
      const ids = (body?.data ?? []).map((d) => d.id);
      const ok = r.status === 200 && !ids.includes(C1) && !ids.includes(C2);
      record(
        "endpoint",
        17,
        "GET /customers excludes deleted/merged",
        ok,
        ok
          ? `${ids.length} live rows, neither id present`
          : `status=${r.status} ids=${pickPreview(ids)}`,
      );
    }

    // ── 18. events_outbox row counts ────────────────────────────────
    if (C1 && C2) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const counts = await countOutboxFor(admin, [C1, C2]);
      const ok =
        counts["customer.created"] === 2 &&
        counts["customer.updated"] >= 2 &&
        counts["customer.merged"] === 1 &&
        counts["customer.deleted"] === 1;
      record(
        "endpoint",
        18,
        "events_outbox counts",
        ok,
        ok ? JSON.stringify(counts) : `counts=${JSON.stringify(counts)}`,
      );
    } else {
      record("endpoint", 18, "events_outbox counts", false, "ids missing");
    }

    // ── Page renders ─────────────────────────────────────────────────
    const pageChecks: Array<{ id: number; path: string; sentinel: RegExp; desc: string }> = [
      { id: 1, path: "/sign-in", sentinel: /Sign in/i, desc: "/sign-in" },
      { id: 2, path: "/home", sentinel: /Bantu Niaga|Modules/i, desc: "/home" },
      {
        id: 3,
        path: "/marketing/customers",
        sentinel: /Customer Profiles CRM|Customers/i,
        desc: "/marketing/customers",
      },
      {
        id: 4,
        path: "/marketing/customers/new",
        sentinel: /Add a new customer|Add customer/i,
        desc: "/marketing/customers/new",
      },
      // C1 is deleted at this point; recreate a fresh customer for the detail render.
      {
        id: 6,
        path: "/marketing/customers/import",
        sentinel: /Marketing M3|Coming in M3/i,
        desc: "/marketing/customers/import",
      },
      {
        id: 7,
        path: "/settings/appearance",
        sentinel: /Appearance/,
        desc: "/settings/appearance",
      },
    ];
    for (const p of pageChecks) {
      const r = await fetchPage(owner, p.path);
      const okStatus = r.status === 200;
      const okBody =
        p.sentinel.test(r.html) &&
        !/Server Error/i.test(r.html) &&
        !/data-nextjs-error/i.test(r.html);
      record(
        "page",
        p.id,
        p.desc,
        okStatus && okBody,
        okStatus && okBody
          ? `200, sentinel matched`
          : `status=${r.status} sentinel-match=${p.sentinel.test(r.html)} preview=${pickPreview(r.html, 200)}`,
      );
    }

    // Detail page render (id #5) — need a live customer that isn't deleted.
    {
      const detailRes = await call(owner, "POST", "/api/marketing/customers", {
        body: {
          name: "Smoke Detail",
          phone: "+60111111111",
        },
      });
      const dBody = detailRes.body as {
        action?: string;
        customer_id?: string;
      };
      if (detailRes.status === 201 && dBody?.customer_id) {
        const detailId = dBody.customer_id;
        createdIds.push(detailId);
        const r = await fetchPage(
          owner,
          `/marketing/customers/${detailId}`,
        );
        const okStatus = r.status === 200;
        const okBody =
          /Smoke Detail/.test(r.html) && !/Server Error/i.test(r.html);
        record(
          "page",
          5,
          `/marketing/customers/${detailId}`,
          okStatus && okBody,
          okStatus && okBody
            ? "200, customer name present"
            : `status=${r.status} sentinel-match=${/Smoke Detail/.test(r.html)} preview=${pickPreview(r.html, 200)}`,
        );
      } else {
        record(
          "page",
          5,
          "/marketing/customers/[id]",
          false,
          `setup-create failed status=${detailRes.status} body=${pickPreview(detailRes.body)}`,
        );
      }
    }

    // ── RBAC negative checks ─────────────────────────────────────────
    let cashierUserId: string | null = null;
    let cashierJar: CookieJar | null = null;
    try {
      cashierUserId = await ensureCashier();
      cashierJar = await signIn(CASHIER_EMAIL, CASHIER_PASSWORD);
    } catch (e) {
      console.warn(
        `[smoke] cashier fixture setup failed: ${
          e instanceof Error ? e.message : e
        }`,
      );
    }

    if (cashierJar) {
      const denyMatrix: Array<{
        id: number;
        method: string;
        path: string;
        body?: unknown;
        headers?: Record<string, string>;
        title: string;
      }> = [
        {
          id: 1,
          method: "GET",
          path: "/api/marketing/customers",
          title: "cashier GET /customers",
        },
        {
          id: 2,
          method: "POST",
          path: "/api/marketing/customers",
          body: { name: "x" },
          title: "cashier POST /customers",
        },
        {
          id: 3,
          method: "PATCH",
          path: `/api/marketing/customers/${createdIds[createdIds.length - 1] ?? C1 ?? "00000000-0000-0000-0000-000000000000"}`,
          body: { notes: "x" },
          title: "cashier PATCH /customers/[id]",
        },
        {
          id: 4,
          method: "DELETE",
          path: `/api/marketing/customers/${createdIds[createdIds.length - 1] ?? C1 ?? "00000000-0000-0000-0000-000000000000"}`,
          title: "cashier DELETE /customers/[id]",
        },
        {
          id: 5,
          method: "POST",
          path: `/api/marketing/customers/${createdIds[createdIds.length - 1] ?? C1 ?? "00000000-0000-0000-0000-000000000000"}/merge`,
          body: {
            winner_id: createdIds[createdIds.length - 1] ?? C1,
            loser_id: "00000000-0000-0000-0000-000000000001",
          },
          title: "cashier POST /customers/[id]/merge",
        },
        {
          id: 6,
          method: "GET",
          path: "/api/marketing/customers/search?q=test",
          title: "cashier GET /customers/search",
        },
      ];
      for (const d of denyMatrix) {
        const r = await call(cashierJar, d.method, d.path, {
          body: d.body,
          headers: d.headers,
        });
        const body = r.body as { error?: string };
        const ok = r.status === 403 && body?.error === "forbidden";
        record(
          "rbac",
          d.id,
          d.title,
          ok,
          ok
            ? "403 forbidden"
            : `status=${r.status} body=${pickPreview(r.body)}`,
        );
      }
    } else {
      record("rbac", 0, "cashier fixture", false, "could not provision");
    }
    if (cashierUserId) {
      await deleteCashier(cashierUserId).catch((e) => {
        console.warn(
          `[smoke] cashier teardown failed: ${
            e instanceof Error ? e.message : e
          }`,
        );
      });
    }
  } finally {
    await hardCleanupCustomers(createdIds).catch((e) => {
      console.warn(
        `[smoke] customer cleanup failed: ${
          e instanceof Error ? e.message : e
        }`,
      );
    });
  }

  // Summary.
  const passes = results.filter((r) => r.status === "PASS").length;
  const fails = results.filter((r) => r.status === "FAIL").length;
  console.log("");
  console.log(`[smoke] PASS=${passes} FAIL=${fails} (total=${results.length})`);
  if (fails > 0) {
    console.log("");
    console.log("FAILS:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  - [${r.group} #${r.id}] ${r.title} :: ${r.detail ?? ""}`);
    }
    process.exit(1);
  }
}

async function preCleanByPhone(phones: string[]): Promise<void> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from("customers")
    .select("id")
    .eq("business_id", BUSINESS_ID)
    .in("phone_e164", phones);
  if (error) {
    console.warn(`[smoke] pre-clean lookup failed: ${error.message}`);
    return;
  }
  const ids = (data ?? []).map((d) => d.id as string);
  if (ids.length > 0) {
    await admin.from("customer_tag_history").delete().in("customer_id", ids);
    await admin.from("customers").delete().in("id", ids);
    console.log(`[smoke] pre-clean: removed ${ids.length} leftover customers`);
  }
}

async function countOutboxFor(
  admin: SupabaseClient,
  customerIds: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {
    "customer.created": 0,
    "customer.updated": 0,
    "customer.merged": 0,
    "customer.deleted": 0,
  };
  const names = Object.keys(counts);
  for (const n of names) {
    const { data, error } = await admin
      .from("events_outbox")
      .select("id, payload")
      .eq("business_id", BUSINESS_ID)
      .eq("name", n);
    if (error) {
      console.warn(`[smoke] outbox query (${n}) failed: ${error.message}`);
      continue;
    }
    const matching = (data ?? []).filter((row) => {
      const payload = row.payload as
        | { customer_id?: string; surviving_customer_id?: string; discarded_customer_id?: string }
        | null;
      if (!payload) return false;
      return (
        (payload.customer_id && customerIds.includes(payload.customer_id)) ||
        (payload.surviving_customer_id &&
          customerIds.includes(payload.surviving_customer_id)) ||
        (payload.discarded_customer_id &&
          customerIds.includes(payload.discarded_customer_id))
      );
    });
    counts[n] = matching.length;
  }
  return counts;
}

main().catch((e) => {
  console.error("[smoke] fatal:", e instanceof Error ? e.stack ?? e.message : e);
  process.exit(2);
});
