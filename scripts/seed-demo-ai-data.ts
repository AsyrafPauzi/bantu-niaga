/**
 * Seed AI-useful dummy data for owner@demo.bantuniaga.local.
 *
 * Assumes the owner + demo business already exist (npm run seed).
 * Idempotent upserts for products, leads, POS, and a couple of lead notes.
 *
 *   npx tsx scripts/seed-demo-ai-data.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { tierBundledCredits } from "../lib/settings/tier-agents";

const DEMO_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";
const DEFAULT_EMAIL = "owner@demo.bantuniaga.local";

const PRODUCT_IDS = {
  nasi: "a1111111-1111-4111-8111-111111111101",
  teh: "a1111111-1111-4111-8111-111111111102",
  kuih: "a1111111-1111-4111-8111-111111111103",
  set: "a1111111-1111-4111-8111-111111111104",
} as const;

const LEAD_IDS = {
  overdue1: "b1111111-1111-4111-8111-111111111101",
  overdue2: "b1111111-1111-4111-8111-111111111102",
  dueToday: "b1111111-1111-4111-8111-111111111103",
  newLead: "b1111111-1111-4111-8111-111111111104",
  interested: "b1111111-1111-4111-8111-111111111105",
  contacted: "b1111111-1111-4111-8111-111111111106",
} as const;

const SALE_IDS = {
  cash: "c1111111-1111-4111-8111-111111111101",
  duitnow: "c1111111-1111-4111-8111-111111111102",
  lunch: "c1111111-1111-4111-8111-111111111103",
} as const;

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

function malaysiaTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

function dayOffsetIso(daysFromToday: number, hour = 10): string {
  const today = malaysiaTodayYmd();
  const d = new Date(
    `${today}T${String(hour).padStart(2, "0")}:00:00+08:00`,
  );
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString();
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

  const email = process.env.SEED_OWNER_EMAIL ?? DEFAULT_EMAIL;
  const businessId = process.env.SEED_BUSINESS_ID ?? DEMO_BUSINESS_ID;
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: owner, error: ownerErr } = await supabase
    .from("users")
    .select("id, business_id, email")
    .eq("email", email)
    .maybeSingle();
  if (ownerErr) throw new Error(ownerErr.message);
  if (!owner) {
    throw new Error(
      `No public.users row for ${email}. Run: npm run seed`,
    );
  }
  if (owner.business_id !== businessId) {
    console.warn(
      `[seed:ai] owner business is ${owner.business_id}, seeding that instead of ${businessId}`,
    );
  }
  const bizId = owner.business_id;
  const userId = owner.id;

  console.log(`[seed:ai] owner ${email} (${userId}) business ${bizId}`);

  // Products for POS / Sufi catalog sample
  const products = [
    {
      id: PRODUCT_IDS.nasi,
      sku: "NL-REG",
      name: "Nasi Lemak Biasa",
      category: "Food",
      price_myr: 8.5,
      description: "Classic nasi lemak with sambal & telur.",
    },
    {
      id: PRODUCT_IDS.teh,
      sku: "DRINK-THO",
      name: "Teh O Ais",
      category: "Drinks",
      price_myr: 3.5,
      description: "Iced black tea.",
    },
    {
      id: PRODUCT_IDS.kuih,
      sku: "SNACK-KUIH",
      name: "Kuih Lapis (2 pcs)",
      category: "Snacks",
      price_myr: 4.0,
      description: "Traditional kuih pair.",
    },
    {
      id: PRODUCT_IDS.set,
      sku: "SET-LUNCH",
      name: "Office Lunch Set",
      category: "Catering",
      price_myr: 12.0,
      description: "Nasi + lauk + drink — office catering.",
    },
  ].map((p) => ({
    ...p,
    business_id: bizId,
    created_by: userId,
    is_active: true,
    deleted_at: null,
  }));

  const { error: prodErr } = await supabase
    .from("operations_products")
    .upsert(products, { onConflict: "id" });
  if (prodErr) throw new Error(`products: ${prodErr.message}`);
  console.log(`[seed:ai] upserted ${products.length} products`);

  // Leads — overdue, due today, pipeline variety
  const leads = [
    {
      id: LEAD_IDS.overdue1,
      name: "Farah Zakaria",
      phone_e164: "+60135551001",
      channel: "whatsapp",
      interest: "Office catering 40 pax — weekly",
      estimated_value_myr: 2400,
      status: "contacted",
      follow_up_at: dayOffsetIso(-3, 9),
    },
    {
      id: LEAD_IDS.overdue2,
      name: "Goh Wei Ming",
      phone_e164: "+60135551002",
      channel: "instagram",
      interest: "Birthday buffet quote",
      estimated_value_myr: 850,
      status: "interested",
      follow_up_at: dayOffsetIso(-1, 14),
    },
    {
      id: LEAD_IDS.dueToday,
      name: "Priya Nair",
      phone_e164: "+60135551003",
      channel: "referral",
      interest: "Trial lunch for clinic staff",
      estimated_value_myr: 480,
      status: "new",
      follow_up_at: dayOffsetIso(0, 11),
    },
    {
      id: LEAD_IDS.newLead,
      name: "Haziq Abdullah",
      phone_e164: "+60135551004",
      channel: "walk_in",
      interest: "Daily nasi lemak packet for shop",
      estimated_value_myr: 1500,
      status: "new",
      follow_up_at: dayOffsetIso(2, 10),
    },
    {
      id: LEAD_IDS.interested,
      name: "Lim Siew Ling",
      phone_e164: "+60135551005",
      channel: "call",
      interest: "Ramadan pre-order (frozen)",
      estimated_value_myr: 3200,
      status: "interested",
      follow_up_at: dayOffsetIso(1, 16),
    },
    {
      id: LEAD_IDS.contacted,
      name: "Amirul Hakim",
      phone_e164: "+60135551006",
      channel: "whatsapp",
      interest: "Event stall partnership",
      estimated_value_myr: 900,
      status: "contacted",
      follow_up_at: null,
    },
  ].map((l) => ({
    ...l,
    business_id: bizId,
    created_by: userId,
    assigned_to: userId,
  }));

  const { error: leadErr } = await supabase
    .from("sales_leads")
    .upsert(leads, { onConflict: "id" });
  if (leadErr) throw new Error(`leads: ${leadErr.message}`);
  console.log(`[seed:ai] upserted ${leads.length} leads`);

  const notes = [
    {
      id: "d1111111-1111-4111-8111-111111111101",
      lead_id: LEAD_IDS.overdue1,
      body: "Said budget OK — waiting on menu confirmation. Chase today.",
    },
    {
      id: "d1111111-1111-4111-8111-111111111102",
      lead_id: LEAD_IDS.dueToday,
      body: "Referred by Aiman (VIP customer). Prefers WhatsApp.",
    },
  ].map((n) => ({
    ...n,
    business_id: bizId,
    created_by: userId,
  }));

  const { error: noteErr } = await supabase
    .from("sales_lead_notes")
    .upsert(notes, { onConflict: "id" });
  if (noteErr) throw new Error(`lead notes: ${noteErr.message}`);
  console.log(`[seed:ai] upserted ${notes.length} lead notes`);

  // Today's POS sales (cash + DuitNow)
  const nowIso = new Date().toISOString();
  const morningIso = dayOffsetIso(0, 8);
  const noonIso = dayOffsetIso(0, 12);

  const sales = [
    {
      id: SALE_IDS.cash,
      sale_number: "POS-DEMO-001",
      subtotal_myr: 25.5,
      discount_amount_myr: 0,
      sst_amount_myr: 0,
      total_myr: 25.5,
      payment_method: "cash",
      payment_received_myr: 30,
      change_myr: 4.5,
      customer_name: "Walk-in",
      created_at: morningIso,
    },
    {
      id: SALE_IDS.duitnow,
      sale_number: "POS-DEMO-002",
      subtotal_myr: 36,
      discount_amount_myr: 0,
      sst_amount_myr: 0,
      total_myr: 36,
      payment_method: "duitnow_qr_static",
      payment_received_myr: 36,
      change_myr: 0,
      customer_name: "Office runner",
      created_at: noonIso,
    },
    {
      id: SALE_IDS.lunch,
      sale_number: "POS-DEMO-003",
      subtotal_myr: 48,
      discount_amount_myr: 3,
      sst_amount_myr: 0,
      total_myr: 45,
      payment_method: "cash",
      payment_received_myr: 50,
      change_myr: 5,
      customer_name: "Aiman Bin Yusof",
      created_at: nowIso,
    },
  ].map((s) => ({
    ...s,
    business_id: bizId,
    cashier_user_id: userId,
    status: "completed",
    updated_at: s.created_at,
  }));

  const { error: saleErr } = await supabase
    .from("pos_sales")
    .upsert(sales, { onConflict: "id" });
  if (saleErr) throw new Error(`pos_sales: ${saleErr.message}`);

  // Wipe + reinsert line items for deterministic demo sales
  await supabase
    .from("pos_sale_items")
    .delete()
    .in("sale_id", Object.values(SALE_IDS));

  const items = [
    {
      sale_id: SALE_IDS.cash,
      product_id: PRODUCT_IDS.nasi,
      product_name: "Nasi Lemak Biasa",
      product_sku: "NL-REG",
      unit_price_myr: 8.5,
      quantity: 2,
      line_total_myr: 17,
      sort_order: 0,
    },
    {
      sale_id: SALE_IDS.cash,
      product_id: PRODUCT_IDS.teh,
      product_name: "Teh O Ais",
      product_sku: "DRINK-THO",
      unit_price_myr: 3.5,
      quantity: 1,
      line_total_myr: 3.5,
      sort_order: 1,
    },
    {
      sale_id: SALE_IDS.cash,
      product_id: PRODUCT_IDS.kuih,
      product_name: "Kuih Lapis (2 pcs)",
      product_sku: "SNACK-KUIH",
      unit_price_myr: 4,
      quantity: 1,
      line_total_myr: 4,
      sort_order: 2,
    },
    {
      sale_id: SALE_IDS.duitnow,
      product_id: PRODUCT_IDS.set,
      product_name: "Office Lunch Set",
      product_sku: "SET-LUNCH",
      unit_price_myr: 12,
      quantity: 3,
      line_total_myr: 36,
      sort_order: 0,
    },
    {
      sale_id: SALE_IDS.lunch,
      product_id: PRODUCT_IDS.set,
      product_name: "Office Lunch Set",
      product_sku: "SET-LUNCH",
      unit_price_myr: 12,
      quantity: 4,
      line_total_myr: 48,
      sort_order: 0,
    },
  ].map((i) => ({ ...i, business_id: bizId }));

  const { error: itemErr } = await supabase.from("pos_sale_items").insert(items);
  if (itemErr) throw new Error(`pos_sale_items: ${itemErr.message}`);
  console.log(
    `[seed:ai] upserted ${sales.length} POS sales + ${items.length} line items`,
  );

  // Ensure agents enabled + credits for planning demos
  const agentRows = [
    { agent_slug: "hr", display_name: "Hana" },
    { agent_slug: "marketing", display_name: "Maya" },
    { agent_slug: "sales", display_name: "Sufi" },
  ].map((a) => ({
    business_id: bizId,
    agent_slug: a.agent_slug,
    display_name: a.display_name,
    assistant_enabled: true,
    daily_notice_enabled: true,
    daily_notice_hour: 8,
    reasoning_mode: "fast",
  }));

  const { error: agentErr } = await supabase
    .from("business_agent_settings")
    .upsert(agentRows, { onConflict: "business_id,agent_slug" });
  if (agentErr) {
    console.warn(`[seed:ai] agent settings skipped: ${agentErr.message}`);
  } else {
    console.log("[seed:ai] agent settings enabled (Hana/Maya/Sufi)");
  }

  // Top up credits if low (do not overwrite a higher existing balance)
  const { data: biz } = await supabase
    .from("businesses")
    .select("credit_balance")
    .eq("id", bizId)
    .single();
  const balance = biz?.credit_balance ?? 0;
  const targetCredits = tierBundledCredits("enterprise");
  if (balance < targetCredits) {
    const { error: credErr } = await supabase
      .from("businesses")
      .update({ credit_balance: targetCredits })
      .eq("id", bizId);
    if (credErr) console.warn(`[seed:ai] credits: ${credErr.message}`);
    else console.log(`[seed:ai] credit_balance set to ${targetCredits} (was ${balance})`);
  } else {
    console.log(`[seed:ai] credits OK (${balance})`);
  }

  // Activate AI add-ons if missing
  const { data: addonCatalog } = await supabase
    .from("marketplace_addons")
    .select("id, slug")
    .in("slug", [
      "hr-assistant",
      "marketing-assistant",
      "sales-assistant",
    ]);
  for (const addon of addonCatalog ?? []) {
    const { data: existing } = await supabase
      .from("business_addons")
      .select("id, status")
      .eq("business_id", bizId)
      .eq("addon_id", addon.id)
      .neq("status", "cancelled")
      .maybeSingle();
    if (existing) continue;
    const { error: actErr } = await supabase.from("business_addons").insert({
      business_id: bizId,
      addon_id: addon.id,
      status: "active",
      qty: 1,
      meta: { seeded: true, source: "seed-demo-ai-data" },
    });
    if (actErr) console.warn(`[seed:ai] addon ${addon.slug}: ${actErr.message}`);
    else console.log(`[seed:ai] activated ${addon.slug}`);
  }

  console.log("\n[seed:ai] done — ask Sufi/Maya/Hana or Boardroom for a plan.");
  console.log(`  email: ${email}`);
  console.log(`  password: ${process.env.SEED_OWNER_PASSWORD ?? "DemoPassword!2026"}`);
}

main().catch((err) => {
  console.error("[seed:ai] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
