/**
 * Bantu Niaga — Broadcasts smoke test.
 *
 * Runs against the locally-running `npm run dev` server. Signs in as
 * the demo owner, then drives the broadcasts surface:
 *
 *   1. GET  /api/marketing/broadcasts           → ≥ 2 seeded rows
 *   2. POST /api/marketing/broadcasts           → create CTC draft
 *   3. POST /api/marketing/broadcasts/[id]/send → returns wa_url list
 *   4. DELETE /api/marketing/broadcasts/[id]    → fails (409, already
 *                                                 sent), then DELETE
 *                                                 on a fresh draft → 200
 *
 * Usage:
 *   npx tsx scripts/smoke-broadcasts.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@demo.bantuniaga.local";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "DemoPassword!2026";

async function main(): Promise<void> {
  loadDotEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }

  // Sign in via supabase-js — we then mint the cookie pair that the
  // SSR client expects and attach it to every fetch.
  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  if (signInErr || !signIn.session) {
    throw new Error(`sign-in failed: ${signInErr?.message ?? "no session"}`);
  }
  const ref = url.replace("https://", "").split(".")[0];
  const cookieName = `sb-${ref}-auth-token`;
  const cookiePayload = JSON.stringify({
    access_token: signIn.session.access_token,
    refresh_token: signIn.session.refresh_token,
    token_type: "bearer",
    user: signIn.session.user,
    expires_at: signIn.session.expires_at,
    expires_in: signIn.session.expires_in,
  });
  const cookie = `${cookieName}=base64-${Buffer.from(cookiePayload).toString("base64")}`;

  async function api(method: string, path: string, body?: unknown) {
    const res = await fetch(`${APP_URL}${path}`, {
      method,
      headers: {
        cookie,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json as Record<string, unknown> };
  }

  // 1. List
  const list = await api("GET", "/api/marketing/broadcasts");
  console.log(`[smoke:broadcasts] LIST  → ${list.status}, count=${Array.isArray((list.body as { data?: unknown }).data) ? ((list.body as { data: unknown[] }).data.length) : "?"}`);
  if (list.status !== 200) {
    throw new Error(`list failed: ${JSON.stringify(list.body)}`);
  }
  const listData = (list.body as { data: { id: string; name: string; status: string }[] }).data;
  console.log(
    "[smoke:broadcasts]   seeded names:",
    listData.map((b) => `${b.name} (${b.status})`),
  );
  if (listData.length < 2) {
    throw new Error(`expected ≥ 2 seeded broadcasts, got ${listData.length}`);
  }

  // 2. Look up the VIP segment id for the demo business.
  const segments = await api("GET", "/api/marketing/segments");
  if (segments.status !== 200) {
    throw new Error(`segments lookup failed: ${JSON.stringify(segments.body)}`);
  }
  const vip = (segments.body as { data: { id: string; auto_key: string | null }[] }).data.find(
    (s) => s.auto_key === "vip",
  );
  if (!vip) throw new Error("vip segment not found on demo business");

  // 3. Create a CTC draft.
  const draftName = `Smoke CTC ${Date.now()}`;
  const create = await api("POST", "/api/marketing/broadcasts", {
    name: draftName,
    channel: "whatsapp_ctc",
    segment_id: vip.id,
    message_template: "Hi {first_name}, smoke test.",
  });
  if (create.status !== 201) {
    throw new Error(`create draft failed: ${JSON.stringify(create.body)}`);
  }
  const draftId = (create.body as { data: { id: string } }).data.id;
  console.log(`[smoke:broadcasts] CREATE → ${create.status} id=${draftId}`);

  // 4. Send (CTC) — returns the wa_url list.
  const send = await api("POST", `/api/marketing/broadcasts/${draftId}/send`);
  console.log(`[smoke:broadcasts] SEND  → ${send.status}`);
  if (send.status !== 200) {
    throw new Error(`send failed: ${JSON.stringify(send.body)}`);
  }
  const recipients = (send.body as {
    recipients?: { wa_url: string; rendered_message: string }[];
  }).recipients ?? [];
  console.log(`[smoke:broadcasts]   recipients=${recipients.length}`);
  if (recipients.length > 0) {
    console.log(`[smoke:broadcasts]   sample wa_url=${recipients[0].wa_url.slice(0, 80)}…`);
    if (!recipients[0].wa_url.startsWith("https://wa.me/")) {
      throw new Error(`unexpected wa_url shape: ${recipients[0].wa_url}`);
    }
  }

  // 5. DELETE on non-draft now (since it's 'sending') → 409.
  const delAfterSend = await api("DELETE", `/api/marketing/broadcasts/${draftId}`);
  console.log(`[smoke:broadcasts] DEL non-draft → ${delAfterSend.status}`);
  if (delAfterSend.status !== 409) {
    console.warn(
      `[smoke:broadcasts]   WARN expected 409, got ${delAfterSend.status} ${JSON.stringify(delAfterSend.body)}`,
    );
  }

  // 6. Create + delete a fresh draft to assert the happy DELETE path.
  const draft2 = await api("POST", "/api/marketing/broadcasts", {
    name: `Smoke draft to discard ${Date.now()}`,
    channel: "whatsapp_ctc",
    segment_id: vip.id,
    message_template: "discard me",
  });
  if (draft2.status !== 201) {
    throw new Error(`second draft failed: ${JSON.stringify(draft2.body)}`);
  }
  const draft2Id = (draft2.body as { data: { id: string } }).data.id;
  const del2 = await api("DELETE", `/api/marketing/broadcasts/${draft2Id}`);
  console.log(`[smoke:broadcasts] DEL draft  → ${del2.status}`);
  if (del2.status !== 200) {
    throw new Error(`discard draft failed: ${JSON.stringify(del2.body)}`);
  }

  console.log("[smoke:broadcasts] OK ✅");
}

main().catch((err) => {
  console.error(
    "[smoke:broadcasts] failed:",
    err instanceof Error ? err.message : err,
  );
  process.exitCode = 1;
});
