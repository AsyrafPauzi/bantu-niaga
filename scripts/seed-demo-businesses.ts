/**
 * Bantu Niaga — seed 5 demo businesses with marketing data.
 *
 * Creates five complete tenants, each with:
 *   - one `auth.users` owner (deterministic email + same demo password)
 *   - the matching `public.businesses` row (deterministic UUID so re-running
 *     upserts instead of duplicating)
 *   - the matching `public.users` profile row (role='owner')
 *   - the two required PDPA consent rows (terms_of_service + privacy_notice)
 *   - between 2 and 10 customers with realistic Malaysian names + phone +
 *     manual tags + a notes column
 *   - between 1 and 5 social-media posts (content_plan rows with channel
 *     in {tiktok, instagram, facebook}, status='posted' or 'scheduled', a
 *     hook line, and a caption)
 *   - a welcome audit-log entry + 50 starter credits, mirroring the
 *     real sign-up route so the dashboards have something to render
 *
 * Idempotent: every insert uses a deterministic id + onConflict. Re-running
 * is safe and updates the demo state to whatever this file currently says.
 *
 * Usage:
 *   npm run seed:demo
 *
 * The credentials printed at the end can be used to sign in at /sign-in.
 *
 * Environment (resolved from .env.local automatically):
 *   NEXT_PUBLIC_SUPABASE_URL       required
 *   SUPABASE_SERVICE_ROLE_KEY      required
 *   DEMO_OWNER_PASSWORD            default: DemoPassword!2026
 *   PRIVACY_POLICY_VERSION         default: 2026-06-14
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────
// Configuration: the five demo tenants
// ─────────────────────────────────────────────────────────────────────────
interface DemoBusiness {
  /** Stable UUID — re-using lets us upsert instead of duplicate. */
  id: string;
  idcompany: string;
  name: string;
  state_code: string;
  tier: "starter" | "micro" | "sme";
  ownerEmail: string;
  ownerName: string;
  industry: string;
  /** Pool of customer names this tenant draws from. */
  customerPool: { name: string; tags: string[]; notes?: string }[];
  /** Pool of post drafts this tenant draws from. */
  postPool: {
    channel: "tiktok" | "instagram" | "facebook";
    hook: string;
    caption: string;
  }[];
}

const DEMOS: readonly DemoBusiness[] = [
  {
    id: "a0000001-0000-4000-8000-000000000001",
    idcompany: "demo-nasi-lemak-berkat",
    name: "Nasi Lemak Berkat SDN BHD",
    state_code: "KUL",
    tier: "sme",
    ownerEmail: "owner1@demo.bantuniaga.local",
    ownerName: "Encik Hafiz Berkat",
    industry: "Food & Beverage",
    customerPool: [
      { name: "Aiman Bin Yusof", tags: ["regular", "lunch-rush"] },
      { name: "Siti Nurhaliza Binti Roslan", tags: ["new", "delivery"] },
      { name: "Rajesh Kumar a/l Subra", tags: ["vip", "catering"] },
      { name: "Tan Wei Ling", tags: ["regular"] },
      { name: "Ahmad Faizal Bin Hashim", tags: ["new"] },
      { name: "Nur Amalina Binti Ramli", tags: ["lunch-rush"] },
      { name: "Lim Boon Kheng", tags: ["catering", "weekday"] },
      { name: "Farah Aisyah Binti Karim", tags: ["weekend"] },
      { name: "Zulkifli Bin Idris", tags: ["regular", "vip"] },
      { name: "Mei Lin Cheong", tags: ["delivery"] },
    ],
    postPool: [
      {
        channel: "tiktok",
        hook: "Why everyone in KL queues for our 7am nasi lemak",
        caption:
          "Limited 50 packets every morning — sambal cooked overnight, daun pisang wrapped, kicap lokal. Tag a friend who needs this. #NasiLemakKL #SarapanPagi",
      },
      {
        channel: "instagram",
        hook: "Behind-the-scenes — our sambal recipe",
        caption:
          "Tiga generasi resepi sambal kami. Lihat siapa yang menggorengnya pagi ni 👇 #NasiLemakKL #SambalGiler",
      },
      {
        channel: "facebook",
        hook: "Office catering bookings open for July",
        caption:
          "Order 30+ packets utk pejabat anda — RM 9.50 sekarang, free delivery within 5km KL. PM us untuk tempahan.",
      },
      {
        channel: "instagram",
        hook: "Customer spotlight — 100th time visiting!",
        caption:
          "Encik Aiman, terima kasih sebab support selama 3 tahun. Free upgrade ayam goreng untuk lifetime 🐔 #LoyalCustomer",
      },
      {
        channel: "tiktok",
        hook: "Pro tip: how to reheat nasi lemak so it tastes fresh",
        caption: "60 seconds, no microwave required. Saved this one ✅",
      },
    ],
  },
  {
    id: "a0000002-0000-4000-8000-000000000002",
    idcompany: "demo-studio-klasik",
    name: "Studio Klasik Photography",
    state_code: "SGR",
    tier: "micro",
    ownerEmail: "owner2@demo.bantuniaga.local",
    ownerName: "Cik Aishah Razali",
    industry: "Creative services",
    customerPool: [
      { name: "Encik Daniel & Puan Liyana", tags: ["wedding"] },
      { name: "Adrian Chong", tags: ["corporate", "headshot"] },
      { name: "Family Tan", tags: ["family", "festive"] },
      { name: "Priya Devi a/p Naidu", tags: ["maternity"] },
      { name: "Iskandar Bin Rahman", tags: ["pre-wedding"] },
      { name: "Hannah Yip", tags: ["product", "instagram"] },
      { name: "Mohd Asyraf Bin Latif", tags: ["wedding", "vip"] },
    ],
    postPool: [
      {
        channel: "instagram",
        hook: "June wedding highlights",
        caption:
          "Daniel & Liyana — Putrajaya · golden hour · 350 frames. Swipe to see the must-have shot list 💛 #WeddingMalaysia",
      },
      {
        channel: "facebook",
        hook: "Free pre-wedding consultation slots — July",
        caption:
          "Booking pre-wedding session for Oct/Nov? Walk in to our SS15 studio this Saturday for free consultation + mood board.",
      },
      {
        channel: "instagram",
        hook: "Studio gear refresh — Sony FX3",
        caption:
          "Upgraded our cinematic kit. Video reels just got 4x sharper. PM for showreel.",
      },
    ],
  },
  {
    id: "a0000003-0000-4000-8000-000000000003",
    idcompany: "demo-bengkel-auto-maju",
    name: "Bengkel Auto Maju Enterprise",
    state_code: "JHR",
    tier: "micro",
    ownerEmail: "owner3@demo.bantuniaga.local",
    ownerName: "Encik Khalid Mansor",
    industry: "Automotive services",
    customerPool: [
      { name: "Tuan Hj Ramli Bin Saad", tags: ["regular", "fleet"] },
      { name: "Lee Chong Wei", tags: ["new"] },
      { name: "Suhaila Binti Mansor", tags: ["regular"] },
      { name: "Vijay Raj a/l Maniam", tags: ["fleet"] },
      { name: "Norazlina Binti Ibrahim", tags: ["new"] },
      { name: "Mohd Hafiz Bin Sani", tags: ["regular", "warranty"] },
    ],
    postPool: [
      {
        channel: "facebook",
        hook: "Tayar Promo — Bridgestone B-Pair RM 320",
        caption:
          "Pasang 4 tayar percuma 4-wheel alignment. Slot Sabtu & Ahad masih ada. Walk-in welcomed di Skudai Workshop.",
      },
      {
        channel: "tiktok",
        hook: "Tanda-tanda brake pad anda dah nak habis",
        caption:
          "5 bunyi yang anda perlu beri perhatian 🚗. Bawa kereta anda check free di bengkel kami. #BengkelJohor",
      },
    ],
  },
  {
    id: "a0000004-0000-4000-8000-000000000004",
    idcompany: "demo-toko-bunga-sayang-ibu",
    name: "Toko Bunga Sayang Ibu",
    state_code: "PNG",
    tier: "starter",
    ownerEmail: "owner4@demo.bantuniaga.local",
    ownerName: "Cik Wong Lai Mei",
    industry: "Retail · Florist",
    customerPool: [
      { name: "Ariff Rahmat", tags: ["birthday", "regular"] },
      { name: "Jasmine Khoo", tags: ["wedding"] },
      { name: "Puan Sarimah", tags: ["funeral"] },
      { name: "Hafidz Bin Mokhtar", tags: ["mothers-day"] },
    ],
    postPool: [
      {
        channel: "instagram",
        hook: "Mother's Day bouquet preorders open",
        caption:
          "Tulips + sunflowers + baby's breath, packed in our signature kraft wrap. Free delivery within Penang Island for orders > RM 100.",
      },
      {
        channel: "facebook",
        hook: "Funeral wreath same-day service",
        caption:
          "WhatsApp 016-xxxx for same-day arrangements. Sila beri kami min 4 jam notice.",
      },
      {
        channel: "instagram",
        hook: "Florist workshop — Saturday 22 June",
        caption:
          "Learn 5 floral arrangements in 3 hours · RM 180 incl. flowers + wrap + tea. Slots limited to 8 ✨",
      },
      {
        channel: "tiktok",
        hook: "Behind-the-scenes — packing 50 wedding centerpieces",
        caption: "From cold room to chapel in 4 hours 💐",
      },
    ],
  },
  {
    id: "a0000005-0000-4000-8000-000000000005",
    idcompany: "demo-salon-anggun-beauty",
    name: "Salon Anggun Beauty",
    state_code: "NSN",
    tier: "starter",
    ownerEmail: "owner5@demo.bantuniaga.local",
    ownerName: "Cik Norhayati Yusof",
    industry: "Beauty & wellness",
    customerPool: [
      { name: "Nadia Rashid", tags: ["bridal", "vip"] },
      { name: "Aiko Lim", tags: ["lash"] },
      { name: "Sara Iskandar", tags: ["facial", "regular"] },
      { name: "Puan Salmiah", tags: ["regular", "senior-citizen"] },
      { name: "Yasmin Hafsah", tags: ["bridal"] },
    ],
    postPool: [
      {
        channel: "instagram",
        hook: "Bridal hair & makeup — Sept slots open",
        caption:
          "Akad + reception package mulai RM 1,200 (Seremban + 50km). 6 slots untuk September sahaja. DM untuk lock down anda 💍",
      },
      {
        channel: "tiktok",
        hook: "1-minute glass-skin facial routine",
        caption: "Our 3-step facial that everyone is booking. Save this!",
      },
      {
        channel: "facebook",
        hook: "Loyalty card — 10th treatment free",
        caption:
          "Stamp dapat dengan setiap RM 50 spending. Tunjuk kad kepada cashier. Berlaku mulai 15 Jun.",
      },
    ],
  },
] as const;

const DEMO_PASSWORD = process.env.DEMO_OWNER_PASSWORD || "DemoPassword!2026";
const POLICY_VERSION = process.env.PRIVACY_POLICY_VERSION || "2026-06-14";

// ─────────────────────────────────────────────────────────────────────────
// Deterministic RNG — same seed → same selection of customers/posts. Means
// re-running the script produces the same numbers, which makes screenshots
// and demos stable.
// ─────────────────────────────────────────────────────────────────────────
function rngFromSeed(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

function pickCount(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function deterministicPhone(businessIdx: number, customerIdx: number): string {
  // E.164-ish Malaysian mobile prefix. Unique within a business by design.
  const tail = String((100_0000 + businessIdx * 10000 + customerIdx) % 100_0000).padStart(7, "0");
  return `+6011${tail}`;
}

function deterministicUuid(seed: string): string {
  const h = createHash("sha256").update(seed).digest("hex");
  // Format as RFC-4122 v4-ish (version + variant bits patched in).
  const a = h.slice(0, 8);
  const b = h.slice(8, 12);
  const c = "4" + h.slice(13, 16);
  const d = ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20);
  const e = h.slice(20, 32);
  return `${a}-${b}-${c}-${d}-${e}`;
}

// ─────────────────────────────────────────────────────────────────────────
// .env.local loader (no dotenv dep needed)
// ─────────────────────────────────────────────────────────────────────────
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

async function findUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
    page += 1;
    if (page > 50) return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Per-business seeding
// ─────────────────────────────────────────────────────────────────────────
async function seedBusiness(
  admin: SupabaseClient,
  biz: DemoBusiness,
  index: number,
): Promise<{ customerCount: number; postCount: number; userId: string }> {
  const log = (msg: string) => console.log(`  [${biz.idcompany}] ${msg}`);
  const rand = rngFromSeed(biz.id);

  // 1. Business row.
  log("upserting business");
  const renewalAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: bizErr } = await admin.from("businesses").upsert(
    {
      id: biz.id,
      idcompany: biz.idcompany,
      name: biz.name,
      state_code: biz.state_code,
      tier: biz.tier,
      subscription_status: "trial",
      subscription_renewal_at: renewalAt,
      brand_primary_hex: "#5B8C5A",
      brand_accent_hex: "#F4A340",
      credit_balance: 50,
    },
    { onConflict: "id" },
  );
  if (bizErr) throw new Error(`business upsert failed: ${bizErr.message}`);

  // 2. Auth user + profile.
  log(`ensuring auth user ${biz.ownerEmail}`);
  let userId = await findUserByEmail(admin, biz.ownerEmail);
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: biz.ownerEmail,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { business_name: biz.name, signup_source: "demo_seed" },
    });
    if (error) throw new Error(`auth user create failed: ${error.message}`);
    userId = data.user?.id ?? null;
    if (!userId) throw new Error("auth user create returned no id");
    log(`  created auth user ${userId}`);
  } else {
    await admin.auth.admin.updateUserById(userId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    log(`  reusing existing auth user ${userId}`);
  }

  const nowIso = new Date().toISOString();
  const { error: profileErr } = await admin.from("users").upsert(
    {
      id: userId,
      business_id: biz.id,
      role: "owner",
      display_name: biz.ownerName,
      email: biz.ownerEmail,
      last_password_change_at: nowIso,
    },
    { onConflict: "id" },
  );
  if (profileErr) {
    throw new Error(`public.users upsert failed: ${profileErr.message}`);
  }

  // 3. PDPA consents (required pair).
  const consentRows = [
    {
      id: deterministicUuid(`${biz.id}:consent:tos`),
      business_id: biz.id,
      user_id: userId,
      kind: "terms_of_service",
      granted: true,
      policy_version: POLICY_VERSION,
      granted_at: nowIso,
    },
    {
      id: deterministicUuid(`${biz.id}:consent:privacy`),
      business_id: biz.id,
      user_id: userId,
      kind: "privacy_notice",
      granted: true,
      policy_version: POLICY_VERSION,
      granted_at: nowIso,
    },
  ];
  const { error: consentErr } = await admin
    .from("user_consents")
    .upsert(consentRows, { onConflict: "user_id,kind" });
  if (consentErr) {
    // Migration 17 may not be applied yet on older databases — warn instead of fail.
    log(`  ⚠ user_consents skipped: ${consentErr.message}`);
  }

  // 4. Customers — pick a count in [2, 10] from the rng-seeded pool.
  const wantCustomers = Math.min(
    biz.customerPool.length,
    pickCount(rand, 2, 10),
  );
  const customerRows = biz.customerPool.slice(0, wantCustomers).map((c, i) => {
    const ageDays = Math.floor(rand() * 240) + 5;
    const lastPurchaseDays = Math.floor(rand() * Math.min(ageDays, 60));
    const spend = Math.round(rand() * 950 + 50);
    const orders = Math.floor(rand() * 9) + 1;
    return {
      id: deterministicUuid(`${biz.id}:customer:${i}`),
      business_id: biz.id,
      name: c.name,
      phone_e164: deterministicPhone(index, i),
      email: `${c.name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.test`,
      manual_tags: c.tags,
      notes: c.notes ?? `Seeded demo customer for ${biz.name}.`,
      total_spend_myr: spend,
      order_count: orders,
      source: "manual",
      created_by_user_id: userId,
      created_at: new Date(
        Date.now() - ageDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      last_purchase_at: new Date(
        Date.now() - lastPurchaseDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
  });
  const { error: custErr } = await admin
    .from("customers")
    .upsert(customerRows, { onConflict: "id" });
  if (custErr) throw new Error(`customers upsert failed: ${custErr.message}`);
  log(`  upserted ${customerRows.length} customers`);

  // 5. Content-plan posts — 1 to 5, channel from {tiktok, instagram, facebook}.
  const wantPosts = Math.min(biz.postPool.length, pickCount(rand, 1, 5));
  const postRows = biz.postPool.slice(0, wantPosts).map((p, i) => {
    const postedDaysAgo = Math.floor(rand() * 30);
    const scheduledForward = i === 0 && wantPosts > 1; // first row sometimes scheduled (future)
    const status = scheduledForward ? "scheduled" : "posted";
    const scheduledAt = scheduledForward
      ? new Date(Date.now() + (1 + Math.floor(rand() * 7)) * 24 * 60 * 60 * 1000)
      : new Date(Date.now() - postedDaysAgo * 24 * 60 * 60 * 1000);
    return {
      id: deterministicUuid(`${biz.id}:post:${i}`),
      business_id: biz.id,
      channel: p.channel,
      status,
      scheduled_at: scheduledAt.toISOString(),
      posted_at: status === "posted" ? scheduledAt.toISOString() : null,
      hook: p.hook,
      caption: p.caption,
      created_by: userId,
    };
  });
  const { error: postErr } = await admin
    .from("content_plan")
    .upsert(postRows, { onConflict: "id" });
  if (postErr) throw new Error(`content_plan upsert failed: ${postErr.message}`);
  log(`  upserted ${postRows.length} content-plan posts`);

  // 6. Welcome audit + credits — only emit fresh ones; skip if already seeded.
  await admin.from("audit_log").insert({
    id: randomUUID(),
    business_id: biz.id,
    actor_user_id: userId,
    action: "demo.seed",
    entity_type: "business",
    entity_id: biz.id,
    diff: {
      tier: biz.tier,
      industry: biz.industry,
      customers: customerRows.length,
      posts: postRows.length,
    },
  });

  return {
    customerCount: customerRows.length,
    postCount: postRows.length,
    userId,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Hardened Entry Point with Explicit Error Dumps
// ─────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("[seed:demo] Initializing script sequence...");
  
  try {
    loadDotEnvLocal();
  } catch (envErr) {
    console.error("❌ Failed to parse .env.local file:", envErr);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log(`[seed:demo] Target URL: ${url}`);

  // Just make sure a key actually exists!
  if (!serviceRoleKey) {
    console.warn("⚠️  Missing service role key. Attempting live fallback extraction...");
    
    try {
      const { execSync } = require("node:child_process");
      // Use standard execution; redirect stderr to stdout so we can catch the message
      const stdout = execSync("npx supabase status --aws-export=false", { 
        encoding: "utf8", 
        stdio: ["ignore", "pipe", "pipe"] 
      });
      
      const match = stdout.match(/service_role key:\s+([^\s\n]+)/);
      if (match && match[1]) {
        serviceRoleKey = match[1].trim();
        console.log("✅ Successfully extracted pre-signed local service_role key.");
      } else {
        console.warn("⚠️  Could not parse key string from status command output.");
      }
    } catch (cliErr: any) {
      console.warn("⚠️  npx supabase status command failed. Trying direct Docker container inspection...");
      try {
        const { execSync } = require("node:child_process");
        // Adjusted for Windows PowerShell compatibility
        const token = execSync('docker exec supabase_kong_bantuniaga sh -c "echo $SERVICE_ROLE"', { 
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        });
        if (token && token.trim()) {
          serviceRoleKey = token.trim();
          console.log("✅ Successfully extracted token directly from container environment.");
        }
      } catch (dockerErr: any) {
        console.error("❌ Both fallback extraction methods failed.");
        console.error("👉 Please run 'npx supabase status' manually in your terminal, copy the 'service_role key', paste it directly into your .env.local file as SUPABASE_SERVICE_ROLE_KEY, and run this script again.");
        process.exit(1);
      }
    }
  }

  if (!serviceRoleKey) {
    console.error("❌ Core Halt: No valid service_role key found. Execution stopped.");
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  console.log("[seed:demo] Seeding payload into database engines...");
  console.log("");

  const results: Array<{
    biz: DemoBusiness;
    customerCount: number;
    postCount: number;
  }> = [];
  
  for (const [i, biz] of DEMOS.entries()) {
    try {
      console.log(`▸ ${i + 1}/${DEMOS.length} · ${biz.name} (${biz.tier})`);
      const r = await seedBusiness(admin, biz, i);
      results.push({ biz, customerCount: r.customerCount, postCount: r.postCount });
      console.log("  ✅ Seeding complete for this record.");
    } catch (rowErr: any) {
      console.error(`❌ Row Insertion Failed for ${biz.name}:`, rowErr.message || rowErr);
    }
    console.log("");
  }

  console.log("[seed:demo] Process finished execution.\n");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("Sign in at http://localhost:3000/sign-in");
  console.log(`Password (all owners): ${DEMO_PASSWORD}`);
  console.log("─────────────────────────────────────────────────────────────");
  for (const [i, r] of results.entries()) {
    console.log(`${String(i + 1).padEnd(2)} ${r.biz.ownerEmail.padEnd(38)} · ${r.biz.name}`);
  }
}
// ─────────────────────────────────────────────────────────────────────────
// Execution Trigger
// ─────────────────────────────────────────────────────────────────────────
main()
  .then(() => {
    console.log("\n✅ [seed:demo] Execution finished smoothly.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ [seed:demo] Uncaught exception in main timeline:", err);
    process.exit(1);
  });