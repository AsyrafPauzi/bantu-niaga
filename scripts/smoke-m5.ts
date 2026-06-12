/**
 * Bantu Niaga — Marketing M5 end-to-end smoke test.
 *
 * Runs against the locally-running `npm run dev` server (default
 * http://localhost:3000) and the remote Supabase project configured
 * in `.env.local`.
 *
 * Drives the M5 content-calendar pipeline end-to-end:
 *
 *   1. Sign in as the seeded owner.
 *   2. POST /api/marketing/content — TikTok draft for next week.
 *   3. GET /api/marketing/content?year=YYYY&month=MM — asserts the
 *      entry appears in the calendar's month window.
 *   4. PATCH /api/marketing/content/[id] — idea → drafted.
 *   5. PATCH /api/marketing/content/[id] — drafted → scheduled.
 *   6. POST /api/marketing/content/[id]/media — attaches a stub uuid.
 *   7. DELETE /api/marketing/content/[id] — assert 200.
 *   8. GET /api/marketing/content/[id] — assert 404.
 *   9. RBAC negative: cashier POST → 403.
 *
 * Idempotent. Cleans up any leftover smoke-tagged entries in `finally`.
 *
 * Usage:
 *   npm run smoke:m5
 *
 * Env overrides (mirroring smoke-m2..m4):
 *   APP_URL                   — default http://localhost:3000
 *   SEED_OWNER_EMAIL          — default owner@demo.bantuniaga.local
 *   SEED_OWNER_PASSWORD       — default DemoPassword!2026
 *   SMOKE_CASHIER_EMAIL       — default cashier-smoke@demo.bantuniaga.local
 *   SMOKE_CASHIER_PASSWORD    — default DemoPassword!2026
 *   SMOKE_BUSINESS_ID         — default 11111111-1111-1111-1111-111111111111
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
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
    "[smoke-m5] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local.",
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

function nextWeekIsoInMyt(): { iso: string; year: number; month: number } {
  // 7 days from now at 09:00 MYT (UTC+8) → 01:00 UTC on the same date.
  const now = new Date();
  const targetUtc = new Date(now.getTime() + 7 * 86_400_000);
  const myt = new Date(targetUtc.getTime() + 8 * 3_600_000);
  const y = myt.getUTCFullYear();
  const m = myt.getUTCMonth() + 1;
  const d = myt.getUTCDate();
  const iso = new Date(Date.UTC(y, m - 1, d, 1, 0, 0)).toISOString();
  return { iso, year: y, month: m };
}

async function preClean(): Promise<void> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  await admin
    .from("content_plan")
    .delete()
    .eq("business_id", BUSINESS_ID)
    .like("hook", "M5 Smoke%");
}

/**
 * Ensure a cashier user exists for the RBAC negative path. Mirrors the
 * helper in `scripts/smoke-m3.ts` so the smoke is self-bootstrapping.
 */
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

async function postClean(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  await admin.from("content_plan").delete().in("id", ids);
}

async function main() {
  console.log(`[smoke-m5] APP_URL=${APP_URL}`);
  console.log(`[smoke-m5] SEED_EMAIL=${SEED_EMAIL}`);

  try {
    const head = await fetch(`${APP_URL}/sign-in`);
    if (head.status !== 200) throw new Error(`HEAD /sign-in returned ${head.status}`);
  } catch (e) {
    console.error(
      `[smoke-m5] FATAL — dev server unreachable at ${APP_URL}: ${
        e instanceof Error ? e.message : e
      }`,
    );
    process.exit(2);
  }

  await preClean();
  try {
    await ensureCashier();
  } catch (e) {
    console.warn(
      `[smoke-m5] ensureCashier failed (RBAC test will skip): ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  const createdIds: string[] = [];
  let owner: CookieJar;
  try {
    owner = await signIn(SEED_EMAIL, SEED_PASSWORD);
    record("auth", 1, "sign in as owner", true);
  } catch (e) {
    record(
      "auth",
      1,
      "sign in as owner",
      false,
      e instanceof Error ? e.message : String(e),
    );
    finishAndExit();
    return;
  }

  try {
    // ── 1. Create a TikTok draft scheduled for next week. ─────────────
    const { iso: nextWeekUtc, year, month } = nextWeekIsoInMyt();
    let entryId: string | null = null;
    {
      const r = await call(owner, "POST", "/api/marketing/content", {
        body: JSON.stringify({
          channel: "tiktok",
          status: "idea",
          scheduled_at: nextWeekUtc,
          hook: `M5 Smoke ${Date.now().toString(36)}`,
          caption: "Smoke-test caption (will be deleted).",
        }),
      });
      const body = r.body as {
        action?: string;
        entry?: { id?: string };
      };
      const ok =
        r.status === 201 &&
        body?.action === "created" &&
        typeof body.entry?.id === "string";
      record(
        "create",
        1,
        "POST /api/marketing/content (idea, scheduled next week)",
        ok,
        ok
          ? `id=${body.entry!.id}`
          : `status=${r.status} body=${pickPreview(r.body)}`,
      );
      if (ok && body.entry?.id) {
        entryId = body.entry.id;
        createdIds.push(body.entry.id);
      } else {
        finishAndExit();
        return;
      }
    }

    // ── 2. List the month — assert our entry is present. ──────────────
    {
      const r = await call(
        owner,
        "GET",
        `/api/marketing/content?year=${year}&month=${month}`,
      );
      const body = r.body as { data?: Array<{ id: string }> };
      const ok =
        r.status === 200 &&
        Array.isArray(body?.data) &&
        body.data.some((row) => row.id === entryId);
      record(
        "list",
        1,
        `GET /api/marketing/content?year=${year}&month=${month}`,
        ok,
        ok
          ? `total=${body.data?.length}`
          : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    }

    // ── 3. PATCH idea → drafted. ─────────────────────────────────────
    {
      const r = await call(owner, "PATCH", `/api/marketing/content/${entryId}`, {
        body: JSON.stringify({ status: "drafted" }),
      });
      const body = r.body as {
        action?: string;
        entry?: { status?: string };
      };
      const ok =
        r.status === 200 && body?.entry?.status === "drafted";
      record(
        "transition",
        1,
        "PATCH idea → drafted",
        ok,
        ok ? `status=drafted` : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    }

    // ── 4. PATCH drafted → scheduled. ────────────────────────────────
    {
      const r = await call(owner, "PATCH", `/api/marketing/content/${entryId}`, {
        body: JSON.stringify({ status: "scheduled" }),
      });
      const body = r.body as {
        action?: string;
        entry?: { status?: string };
      };
      const ok =
        r.status === 200 && body?.entry?.status === "scheduled";
      record(
        "transition",
        2,
        "PATCH drafted → scheduled",
        ok,
        ok ? `status=scheduled` : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    }

    // ── 5. Attach a media file_id stub. ──────────────────────────────
    const fileId = randomUUID();
    {
      const r = await call(
        owner,
        "POST",
        `/api/marketing/content/${entryId}/media`,
        {
          body: JSON.stringify({ file_id: fileId, position: 0 }),
        },
      );
      const body = r.body as { media?: { file_id?: string } };
      const ok =
        r.status === 201 && body?.media?.file_id === fileId;
      record(
        "media",
        1,
        "POST /api/marketing/content/[id]/media",
        ok,
        ok ? `file_id=${fileId}` : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    }

    // ── 6. DELETE the entry. ─────────────────────────────────────────
    {
      const r = await call(owner, "DELETE", `/api/marketing/content/${entryId}`);
      const body = r.body as { action?: string };
      const ok = r.status === 200 && body?.action === "deleted";
      record(
        "delete",
        1,
        "DELETE /api/marketing/content/[id]",
        ok,
        ok ? "deleted" : `status=${r.status} body=${pickPreview(r.body)}`,
      );
      if (ok) {
        // Already gone — drop from cleanup list.
        const idx = createdIds.indexOf(entryId!);
        if (idx >= 0) createdIds.splice(idx, 1);
      }
    }

    // ── 7. GET again — assert 404. ───────────────────────────────────
    {
      const r = await call(owner, "GET", `/api/marketing/content/${entryId}`);
      const ok = r.status === 404;
      record(
        "verify",
        1,
        "GET /api/marketing/content/[id] after delete → 404",
        ok,
        ok ? "404 as expected" : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    }

    // ── 8. RBAC negative: cashier POST → 403. ────────────────────────
    try {
      const cashier = await signIn(CASHIER_EMAIL, CASHIER_PASSWORD);
      const r = await call(cashier, "POST", "/api/marketing/content", {
        body: JSON.stringify({
          channel: "tiktok",
          status: "idea",
          hook: "M5 Smoke cashier-rejected",
        }),
      });
      const ok = r.status === 403;
      record(
        "rbac",
        1,
        "cashier POST /api/marketing/content → 403",
        ok,
        ok ? "403 forbidden" : `status=${r.status} body=${pickPreview(r.body)}`,
      );
    } catch (e) {
      record(
        "rbac",
        1,
        "cashier POST /api/marketing/content → 403",
        false,
        `cashier sign-in failed: ${
          e instanceof Error ? e.message : String(e)
        }. ` +
          `Seed a cashier via scripts/seed-owner (or set SMOKE_CASHIER_EMAIL/PASSWORD).`,
      );
    }
  } finally {
    await postClean(createdIds).catch((e) => {
      console.warn(
        `[smoke-m5] cleanup failed: ${e instanceof Error ? e.message : e}`,
      );
    });
  }

  finishAndExit();
}

function finishAndExit(): never {
  const passes = results.filter((r) => r.status === "PASS").length;
  const fails = results.filter((r) => r.status === "FAIL").length;
  console.log("");
  console.log(`[smoke-m5] PASS=${passes} FAIL=${fails} (total=${results.length})`);
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
    "[smoke-m5] fatal:",
    e instanceof Error ? e.stack ?? e.message : e,
  );
  process.exit(2);
});
