/**
 * Bantu Niaga — seed demo broadcasts.
 *
 * One-shot: upserts two example broadcasts onto the demo business
 * (`11111111-1111-1111-1111-111111111111`) so /marketing/broadcasts
 * has real data when the operator opens it:
 *
 *   1. One SENT WhatsApp click-to-chat broadcast targeting the demo
 *      business's auto `vip` segment. Three recipient rows (any three
 *      customers from the business), all marked `sent`.
 *   2. One DRAFT email broadcast (no recipients yet — drafts have
 *      none until /send is called).
 *
 * Idempotent: fixed UUIDs + upsert on (id). Re-runs leave the row
 * counts stable.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-broadcasts.ts
 *
 * Environment (loaded from .env.local automatically):
 *   NEXT_PUBLIC_SUPABASE_URL       required
 *   SUPABASE_SERVICE_ROLE_KEY      required
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEMO_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";

// Fixed UUIDs so re-runs upsert in place.
const SENT_CTC_BROADCAST_ID = "30000000-0000-4000-8000-000000000001";
const DRAFT_EMAIL_BROADCAST_ID = "30000000-0000-4000-8000-000000000002";

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

interface CustomerRow {
  id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
}

async function main(): Promise<void> {
  loadDotEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  console.log("[seed:demo-broadcasts] target business:", DEMO_BUSINESS_ID);

  // 1. Look up the vip auto segment for this business.
  const { data: vipSeg, error: vipErr } = await admin
    .from("customer_segments")
    .select("id, name")
    .eq("business_id", DEMO_BUSINESS_ID)
    .eq("kind", "auto")
    .eq("auto_key", "vip")
    .maybeSingle();
  if (vipErr) {
    throw new Error(`failed to load vip segment: ${vipErr.message}`);
  }
  if (!vipSeg) {
    throw new Error(
      `vip auto segment not found for business ${DEMO_BUSINESS_ID} — did the segments migration run?`,
    );
  }

  // 2. Pick three customers (any non-deleted, with phones) to mock as
  // the resolved recipient snapshot for the sent CTC broadcast. The
  // RecipientRow doesn't require them to currently match the segment
  // — these are point-in-time send snapshots.
  const { data: customersRaw, error: custErr } = await admin
    .from("customers")
    .select("id, name, phone_e164, email")
    .eq("business_id", DEMO_BUSINESS_ID)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .not("phone_e164", "is", null)
    .order("created_at", { ascending: true })
    .limit(3);
  if (custErr) {
    throw new Error(`failed to load customers: ${custErr.message}`);
  }
  const customers = (customersRaw ?? []) as CustomerRow[];
  if (customers.length < 1) {
    throw new Error(
      "demo business has zero customers with a phone — seed customers first.",
    );
  }
  // Pad up to 3 by repeating the last customer (idempotent upserts on
  // unique (broadcast_id, customer_id) make duplicates harmless — we
  // just take whatever's there.).
  const padded = customers.slice(0, 3);

  // 3. Find a coupon to reference. The coupons table may not exist in
  // some environments — handle gracefully.
  let demoCouponId: string | null = null;
  try {
    const { data: coupon } = await admin
      .from("coupons")
      .select("id")
      .eq("business_id", DEMO_BUSINESS_ID)
      .limit(1)
      .maybeSingle();
    if (coupon?.id) demoCouponId = coupon.id as string;
  } catch {
    demoCouponId = null;
  }

  // 4. Upsert the sent CTC broadcast row.
  const nowIso = new Date().toISOString();
  const sentCount = padded.length;
  const { error: sentInsErr } = await admin
    .from("broadcasts")
    .upsert(
      {
        id: SENT_CTC_BROADCAST_ID,
        business_id: DEMO_BUSINESS_ID,
        name: "Raya VIP push (sample)",
        channel: "whatsapp_ctc",
        segment_id: vipSeg.id,
        subject: null,
        message_template:
          "Hi {first_name}, this Raya only — show this WhatsApp to claim {coupon_code}!",
        coupon_id: demoCouponId,
        status: "sent",
        total_recipients: sentCount,
        sent_count: sentCount,
        failed_count: 0,
        sent_at: nowIso,
      },
      { onConflict: "id" },
    );
  if (sentInsErr) {
    throw new Error(`sent broadcast upsert failed: ${sentInsErr.message}`);
  }

  // Clean + re-insert recipients for the sent broadcast so the
  // snapshot count stays stable across re-runs even if the underlying
  // customer list changed.
  const { error: delRcptErr } = await admin
    .from("broadcast_recipients")
    .delete()
    .eq("broadcast_id", SENT_CTC_BROADCAST_ID);
  if (delRcptErr) {
    throw new Error(`recipient cleanup failed: ${delRcptErr.message}`);
  }

  const recipientRows = padded.map((c) => ({
    broadcast_id: SENT_CTC_BROADCAST_ID,
    customer_id: c.id,
    channel_address: c.phone_e164 ?? "",
    rendered_message: `Hi ${c.name.split(/\s+/)[0]}, this Raya only — show this WhatsApp to claim RAYA20!`,
    rendered_subject: null,
    status: "sent" as const,
    sent_at: nowIso,
  }));

  if (recipientRows.length > 0) {
    const { error: rcptErr } = await admin
      .from("broadcast_recipients")
      .insert(recipientRows);
    if (rcptErr) {
      throw new Error(`recipient insert failed: ${rcptErr.message}`);
    }
  }

  // 5. Upsert the draft email broadcast.
  const { error: draftErr } = await admin
    .from("broadcasts")
    .upsert(
      {
        id: DRAFT_EMAIL_BROADCAST_ID,
        business_id: DEMO_BUSINESS_ID,
        name: "Weekly newsletter (draft)",
        channel: "email",
        segment_id: vipSeg.id,
        subject: "{first_name}, your weekly Bantu Niaga update",
        message_template:
          "Hi {first_name},\n\nThanks for being a VIP — here's what's new this week.",
        coupon_id: null,
        status: "draft",
        total_recipients: 0,
        sent_count: 0,
        failed_count: 0,
        sent_at: null,
      },
      { onConflict: "id" },
    );
  if (draftErr) {
    throw new Error(`draft broadcast upsert failed: ${draftErr.message}`);
  }

  console.log(
    `[seed:demo-broadcasts] OK — sent broadcast ${SENT_CTC_BROADCAST_ID} (recipients: ${recipientRows.length}), draft ${DRAFT_EMAIL_BROADCAST_ID}.`,
  );
}

main().catch((err) => {
  console.error(
    "[seed:demo-broadcasts] failed:",
    err instanceof Error ? err.message : err,
  );
  process.exitCode = 1;
});
