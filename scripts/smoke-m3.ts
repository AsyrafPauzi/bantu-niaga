/**
 * Bantu Niaga — Marketing M3 end-to-end smoke test.
 *
 * Runs against the locally-running `npm run dev` server (default
 * http://localhost:3000) and the remote Supabase project configured in
 * `.env.local`.
 *
 * Drives every M3 surface end-to-end:
 *   1. POST  /api/marketing/customers/csv-import           (upload)
 *   2. GET   /api/marketing/customers/csv-import/[id]/preview
 *   3. POST  /api/marketing/customers/csv-import/[id]/commit
 *   4. GET   /api/marketing/customers/csv-export
 *   5. Round-trip: re-upload export → preview marks everything `merged`
 *   6. RBAC negative checks for `cashier`
 *   7. Page render: /marketing/customers/import (wizard mounts)
 *
 * Idempotent. Cleans up created customers + csv imports + storage
 * objects + outbox rows in `finally`. Uses the same env loader pattern
 * as `scripts/smoke-m2.ts` to avoid pulling in a dotenv dep.
 *
 * Usage:
 *   npm run smoke:m3
 *
 * Env overrides (mirroring smoke-m2):
 *   APP_URL                   — default http://localhost:3000
 *   SEED_OWNER_EMAIL          — default owner@demo.bantuniaga.local
 *   SEED_OWNER_PASSWORD       — default DemoPassword!2026
 *   SMOKE_CASHIER_EMAIL       — default cashier-smoke@demo.bantuniaga.local
 *   SMOKE_CASHIER_PASSWORD    — default DemoPassword!2026
 *   SMOKE_BUSINESS_ID         — default 11111111-1111-1111-1111-111111111111
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
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
const CASHIER_EMAIL =
  process.env.SMOKE_CASHIER_EMAIL ?? "cashier-smoke@demo.bantuniaga.local";
const CASHIER_PASSWORD =
  process.env.SMOKE_CASHIER_PASSWORD ?? "DemoPassword!2026";
const BUSINESS_ID =
  process.env.SMOKE_BUSINESS_ID ?? "11111111-1111-1111-1111-111111111111";

if (!SUPABASE_URL || !SUPABASE_ANON || !SUPABASE_SERVICE) {
  console.error(
    "[smoke-m3] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────
// Cookie jar (lifted from smoke-m2 verbatim).
// ─────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────
// Result tracking.
// ─────────────────────────────────────────────────────────────────────
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

async function fetchPage(
  jar: CookieJar,
  path: string,
): Promise<{ status: number; html: string }> {
  const headers: Record<string, string> = { Accept: "text/html" };
  const cookieHeader = jar.toHeader();
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  const res = await fetch(`${APP_URL}${path}`, {
    headers,
    redirect: "manual",
  });
  const html = await res.text();
  return { status: res.status, html };
}

// ─────────────────────────────────────────────────────────────────────
// Fixture cashier (same email as smoke-m2 so they share the row).
// ─────────────────────────────────────────────────────────────────────
async function ensureCashier(): Promise<string | null> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

// ─────────────────────────────────────────────────────────────────────
// Cleanup helpers.
// ─────────────────────────────────────────────────────────────────────
async function preCleanByPhone(phones: string[]): Promise<void> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await admin
    .from("customers")
    .select("id")
    .eq("business_id", BUSINESS_ID)
    .in("phone_e164", phones);
  const ids = (data ?? []).map((d) => d.id as string);
  if (ids.length > 0) {
    await admin.from("customer_tag_history").delete().in("customer_id", ids);
    await admin.from("customers").delete().in("id", ids);
  }
}

/**
 * Stale-import sweep — clear any non-committed imports for this business
 * left over from a crashed prior run, so the "one in-flight import per
 * business" check at upload time doesn't 409 us out of the gate.
 */
async function preCleanInFlightImports(): Promise<void> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await admin
    .from("customer_csv_imports")
    .select("id, storage_path")
    .eq("business_id", BUSINESS_ID)
    .in("status", ["uploaded", "previewed"]);
  const stale = (data ?? []) as Array<{ id: string; storage_path: string | null }>;
  if (stale.length === 0) return;
  const paths = stale.map((r) => r.storage_path).filter(Boolean) as string[];
  if (paths.length > 0) {
    await admin.storage.from("csv-imports").remove(paths);
  }
  await admin
    .from("customer_csv_imports")
    .delete()
    .in(
      "id",
      stale.map((r) => r.id),
    );
}

async function hardCleanupCustomers(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from("customer_tag_history").delete().in("customer_id", ids);
  await admin.from("customers").delete().in("id", ids);
}

async function cleanupImports(importIds: string[]): Promise<void> {
  if (importIds.length === 0) return;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await admin
    .from("customer_csv_imports")
    .select("storage_path")
    .in("id", importIds);
  const paths = (data ?? [])
    .map((r) => r.storage_path as string)
    .filter(Boolean);
  if (paths.length > 0) {
    await admin.storage.from("csv-imports").remove(paths);
  }
  await admin.from("customer_csv_imports").delete().in("id", importIds);
}

async function countCsvCreatedOutboxFor(
  admin: SupabaseClient,
  customerIds: string[],
): Promise<number> {
  if (customerIds.length === 0) return 0;
  const { data } = await admin
    .from("events_outbox")
    .select("payload")
    .eq("business_id", BUSINESS_ID)
    .eq("name", "customer.created");
  let count = 0;
  for (const row of data ?? []) {
    const payload = (row as { payload: { customer_id?: string; source?: string } })
      .payload;
    if (
      payload?.source === "csv_import" &&
      payload.customer_id &&
      customerIds.includes(payload.customer_id)
    ) {
      count += 1;
    }
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────
// Test CSV fixtures (kept inline so reruns are self-contained).
// ─────────────────────────────────────────────────────────────────────
const SMOKE_PHONES = ["+60131110001", "+60131110002", "+60131110003"];
const SMOKE_CSV_CLEAN = [
  "name,phone,email,address,notes,manual_tags",
  "M3 Smoke Alice,0131110001,alice@m3smoke.test,,Imported,vip|kedai-runcit",
  "M3 Smoke Bob,0131110002,bob@m3smoke.test,KL,,gold",
  "M3 Smoke Carol,0131110003,carol@m3smoke.test,,,",
].join("\n");

async function main() {
  console.log(`[smoke-m3] APP_URL=${APP_URL}`);
  console.log(`[smoke-m3] SEED_EMAIL=${SEED_EMAIL}`);

  // Dev server health check.
  try {
    const head = await fetch(`${APP_URL}/sign-in`);
    if (head.status !== 200) {
      throw new Error(`HEAD /sign-in returned ${head.status}`);
    }
  } catch (e) {
    console.error(
      `[smoke-m3] FATAL — dev server unreachable at ${APP_URL}: ${
        e instanceof Error ? e.message : e
      }`,
    );
    process.exit(2);
  }

  const owner = await signIn(SEED_EMAIL, SEED_PASSWORD);
  console.log(`[smoke-m3] signed in as owner (cookies: ${owner.getAll().length})`);

  // Pre-clean any stale rows / imports left over from a prior run.
  await preCleanByPhone(SMOKE_PHONES);
  await preCleanInFlightImports();

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const createdCustomerIds: string[] = [];
  const importIds: string[] = [];

  try {
    // ── 1. Upload (multipart) ────────────────────────────────────────
    let cleanImportId = "";
    {
      const fd = new FormData();
      fd.append(
        "file",
        new Blob([SMOKE_CSV_CLEAN], { type: "text/csv" }),
        "m3-smoke-clean.csv",
      );
      const r = await call(owner, "POST", "/api/marketing/customers/csv-import", {
        body: fd,
      });
      const body = r.body as {
        import_id?: string;
        file_size_bytes?: number;
      };
      const ok =
        r.status === 201 && typeof body?.import_id === "string";
      record(
        "endpoint",
        1,
        "POST /csv-import (upload)",
        ok,
        ok
          ? `import_id=${body.import_id} size=${body.file_size_bytes}`
          : `status=${r.status} body=${pickPreview(r.body)}`,
      );
      if (body?.import_id) {
        cleanImportId = body.import_id;
        importIds.push(cleanImportId);
      }
    }

    // ── 2. Preview ───────────────────────────────────────────────────
    if (cleanImportId) {
      const r = await call(
        owner,
        "GET",
        `/api/marketing/customers/csv-import/${cleanImportId}/preview`,
      );
      const body = r.body as {
        summary?: { total: number; created: number; merged: number; rejected: number };
        created?: Array<{ name: string; phone_e164: string }>;
      };
      const ok =
        r.status === 200 &&
        body?.summary?.total === 3 &&
        body?.summary?.created === 3 &&
        body?.summary?.merged === 0 &&
        body?.summary?.rejected === 0 &&
        (body?.created ?? []).every((row) => row.phone_e164.startsWith("+60"));
      record(
        "endpoint",
        2,
        "GET /csv-import/[id]/preview",
        ok,
        ok ? JSON.stringify(body.summary) : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    } else {
      record("endpoint", 2, "GET /csv-import/[id]/preview", false, "no import_id");
    }

    // ── 3. Commit ────────────────────────────────────────────────────
    if (cleanImportId) {
      const r = await call(
        owner,
        "POST",
        `/api/marketing/customers/csv-import/${cleanImportId}/commit`,
      );
      const body = r.body as {
        action?: string;
        created?: number;
        merged?: number;
        rejected?: number;
        total?: number;
        created_customer_ids?: string[];
      };
      const ok =
        r.status === 200 &&
        body?.action === "committed" &&
        body?.created === 3 &&
        Array.isArray(body?.created_customer_ids) &&
        body.created_customer_ids.length === 3;
      record(
        "endpoint",
        3,
        "POST /csv-import/[id]/commit",
        ok,
        ok
          ? `created=${body.created} ids=${body.created_customer_ids?.length ?? 0}`
          : `status=${r.status} body=${pickPreview(r.body)}`,
      );
      if (Array.isArray(body?.created_customer_ids)) {
        createdCustomerIds.push(...body.created_customer_ids);
      }
    } else {
      record("endpoint", 3, "POST /csv-import/[id]/commit", false, "no import_id");
    }

    // ── 4. DB + outbox post-commit assertions ───────────────────────
    {
      const { data } = await adminClient
        .from("customers")
        .select("id, name, phone_e164, source")
        .eq("business_id", BUSINESS_ID)
        .in("phone_e164", SMOKE_PHONES);
      const ok =
        (data ?? []).length === 3 &&
        (data ?? []).every(
          (c) => (c as { source: string }).source === "csv_import",
        );
      record(
        "db",
        1,
        "customers row count after commit",
        ok,
        ok ? `found 3 csv_import rows` : `found ${(data ?? []).length}`,
      );
    }
    {
      const count = await countCsvCreatedOutboxFor(adminClient, createdCustomerIds);
      const ok = count === createdCustomerIds.length && count > 0;
      record(
        "db",
        2,
        "customer.created outbox events emitted",
        ok,
        ok
          ? `${count} matching events`
          : `expected ${createdCustomerIds.length}, got ${count}`,
      );
    }

    // ── 5. Re-commit → 409 ──────────────────────────────────────────
    if (cleanImportId) {
      const r = await call(
        owner,
        "POST",
        `/api/marketing/customers/csv-import/${cleanImportId}/commit`,
      );
      const body = r.body as { error?: string };
      const ok = r.status === 409 && body?.error === "already_committed";
      record(
        "endpoint",
        5,
        "POST /commit second time",
        ok,
        ok ? `409 already_committed` : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    } else {
      record("endpoint", 5, "POST /commit second time", false, "no import_id");
    }

    // ── 6. Export the current book ──────────────────────────────────
    let exportBody = "";
    {
      const r = await fetch(
        `${APP_URL}/api/marketing/customers/csv-export`,
        {
          headers: { Cookie: owner.toHeader() },
        },
      );
      const text = await r.text();
      const ok =
        r.status === 200 &&
        r.headers.get("content-type")?.includes("text/csv") === true &&
        text.includes("name,phone,email,address,notes,manual_tags,auto_tags") &&
        SMOKE_PHONES.every((p) => text.includes(p));
      record(
        "endpoint",
        6,
        "GET /csv-export",
        ok,
        ok
          ? `${text.split("\n").filter(Boolean).length - 1} data rows`
          : `status=${r.status} preview=${pickPreview(text, 240)}`,
      );
      if (ok) exportBody = text;
    }

    // ── 7. Round-trip: re-upload export → all merged ────────────────
    let roundtripImportId = "";
    if (exportBody) {
      const fd = new FormData();
      fd.append(
        "file",
        new Blob([exportBody], { type: "text/csv" }),
        "m3-smoke-roundtrip.csv",
      );
      const upRes = await call(
        owner,
        "POST",
        "/api/marketing/customers/csv-import",
        { body: fd },
      );
      const upBody = upRes.body as { import_id?: string };
      if (upRes.status === 201 && upBody?.import_id) {
        roundtripImportId = upBody.import_id;
        importIds.push(roundtripImportId);
        const prev = await call(
          owner,
          "GET",
          `/api/marketing/customers/csv-import/${roundtripImportId}/preview`,
        );
        const prevBody = prev.body as {
          summary?: { created: number; merged: number; rejected: number; total: number };
        };
        const seededRows = SMOKE_PHONES.length;
        const ok =
          prev.status === 200 &&
          prevBody?.summary?.merged !== undefined &&
          prevBody.summary.merged >= seededRows &&
          prevBody.summary.created === 0;
        record(
          "endpoint",
          7,
          "round-trip: export → re-import → all merged",
          ok,
          ok
            ? JSON.stringify(prevBody.summary)
            : `status=${prev.status} body=${pickPreview(prev.body)}`,
        );
      } else {
        record(
          "endpoint",
          7,
          "round-trip upload",
          false,
          `status=${upRes.status} body=${pickPreview(upRes.body)}`,
        );
      }
    } else {
      record("endpoint", 7, "round-trip (no export body)", false, "skipped");
    }

    // ── 8. Page render ──────────────────────────────────────────────
    {
      const r = await fetchPage(owner, "/marketing/customers/import");
      const ok =
        r.status === 200 &&
        /Import customers from CSV/i.test(r.html) &&
        /1\. Upload/i.test(r.html) &&
        !/Server Error/i.test(r.html);
      record(
        "page",
        1,
        "/marketing/customers/import",
        ok,
        ok ? "wizard mounted" : `status=${r.status} preview=${pickPreview(r.html, 200)}`,
      );
    }

    // ── 9. RBAC: cashier denied on every endpoint ───────────────────
    let cashierUserId: string | null = null;
    let cashierJar: CookieJar | null = null;
    try {
      cashierUserId = await ensureCashier();
      cashierJar = await signIn(CASHIER_EMAIL, CASHIER_PASSWORD);
    } catch (e) {
      console.warn(
        `[smoke-m3] cashier fixture setup failed: ${
          e instanceof Error ? e.message : e
        }`,
      );
    }
    if (cashierJar) {
      const denyMatrix: Array<{
        id: number;
        method: string;
        path: string;
        title: string;
        body?: BodyInit;
      }> = [
        {
          id: 1,
          method: "GET",
          path: "/api/marketing/customers/csv-export",
          title: "cashier GET /csv-export",
        },
        {
          id: 2,
          method: "POST",
          path: "/api/marketing/customers/csv-import",
          body: (() => {
            const fd = new FormData();
            fd.append(
              "file",
              new Blob(["name,phone\nX,012"], { type: "text/csv" }),
              "x.csv",
            );
            return fd;
          })(),
          title: "cashier POST /csv-import",
        },
        {
          id: 3,
          method: "GET",
          path: `/api/marketing/customers/csv-import/${cleanImportId || "00000000-0000-0000-0000-000000000000"}/preview`,
          title: "cashier GET /preview",
        },
        {
          id: 4,
          method: "POST",
          path: `/api/marketing/customers/csv-import/${cleanImportId || "00000000-0000-0000-0000-000000000000"}/commit`,
          title: "cashier POST /commit",
        },
      ];
      for (const d of denyMatrix) {
        const r = await call(cashierJar, d.method, d.path, { body: d.body });
        const body = r.body as { error?: string };
        const ok = r.status === 403 && body?.error === "forbidden";
        record(
          "rbac",
          d.id,
          d.title,
          ok,
          ok ? "403 forbidden" : `status=${r.status} body=${pickPreview(r.body)}`,
        );
      }
    } else {
      record("rbac", 0, "cashier fixture", false, "could not provision");
    }
    if (cashierUserId) {
      await deleteCashier(cashierUserId).catch((e) => {
        console.warn(
          `[smoke-m3] cashier teardown failed: ${
            e instanceof Error ? e.message : e
          }`,
        );
      });
    }
  } finally {
    await hardCleanupCustomers(createdCustomerIds).catch((e) => {
      console.warn(
        `[smoke-m3] customer cleanup failed: ${e instanceof Error ? e.message : e}`,
      );
    });
    await cleanupImports(importIds).catch((e) => {
      console.warn(
        `[smoke-m3] import cleanup failed: ${e instanceof Error ? e.message : e}`,
      );
    });
  }

  // Summary.
  const passes = results.filter((r) => r.status === "PASS").length;
  const fails = results.filter((r) => r.status === "FAIL").length;
  console.log("");
  console.log(`[smoke-m3] PASS=${passes} FAIL=${fails} (total=${results.length})`);
  if (fails > 0) {
    console.log("");
    console.log("FAILS:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  - [${r.group} #${r.id}] ${r.title} :: ${r.detail ?? ""}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[smoke-m3] fatal:", e instanceof Error ? e.stack ?? e.message : e);
  process.exit(2);
});
