/**
 * Reset Bantu Niaga Demo SDN BHD and seed ~6 months of cross-module dummy data.
 *
 *   1. Reset owner password (owner@demo.bantuniaga.local)
 *   2. Purge all tenant-scoped rows for the demo business
 *   3. Seed HR, Marketing, Sales, Operations, Finance, Admin, Boardroom data
 *
 * Usage:
 *   npm run demo:reset
 *
 * Env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD (optional)
 */
import { execSync } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_OWNER_EMAIL,
  DEFAULT_OWNER_PASSWORD,
  DEMO_BUSINESS_ID,
  DEMO_MONTHS,
  createServiceAdmin,
  daysAgoIso,
  daysFromNowYmd,
  demoUuid,
  loadDotEnvLocal,
  malaysiaTodayYmd,
  shareHashFromIndex,
} from "./lib/demo-env";
import { purgeDemoBusinessData } from "./lib/purge-demo-business";
import { seedAdminStorage } from "./lib/seed-admin-storage";
import { tierBundledCredits } from "../lib/settings/tier-agents";

const CUSTOMER_NAMES = [
  "Aiman Bin Yusof",
  "Siti Nurhaliza Binti Roslan",
  "Rajesh Kumar a/l Subra",
  "Tan Wei Ling",
  "Farah Aisyah Binti Karim",
  "Lim Boon Kheng",
  "Zulkifli Bin Idris",
  "Mei Lin Cheong",
  "Haziq Abdullah",
  "Priya Nair",
  "Goh Wei Ming",
  "Amirul Hakim",
  "Nurul Izzah",
  "Daniel Tan",
  "Encik Daniel & Puan Liyana",
  "Adrian Chong",
  "Hannah Yip",
  "Mohd Asyraf Bin Latif",
  "Iskandar Bin Rahman",
  "Family Tan",
  "Kavitha a/p Murugan",
  "Wong Chee Keong",
  "Nadia Binti Rahman",
  "Ravi Chandran",
  "Chong Mei Yee",
  "Syafiq Hakimi",
  "Liyana Zainal",
  "Ong Boon Huat",
  "Fatimah Zahra",
  "Kevin Liew",
  "Saraswathy Devi",
  "Irfan Hakimi",
  "Jessica Lim",
  "Arif Bin Kamal",
  "Michelle Yeoh",
];

const PRODUCT_CATALOG = [
  { sku: "NL-REG", name: "Nasi Lemak Biasa", category: "Food", price: 8.5 },
  { sku: "NL-AYAM", name: "Nasi Lemak Ayam Goreng", category: "Food", price: 12 },
  { sku: "DRINK-THO", name: "Teh O Ais", category: "Drinks", price: 3.5 },
  { sku: "DRINK-KOPI", name: "Kopi O", category: "Drinks", price: 3 },
  { sku: "SNACK-KUIH", name: "Kuih Lapis (2 pcs)", category: "Snacks", price: 4 },
  { sku: "SET-LUNCH", name: "Office Lunch Set", category: "Catering", price: 12 },
  { sku: "SET-TEA", name: "Afternoon Tea Box", category: "Catering", price: 18 },
  { sku: "CATER-50", name: "Catering 50 pax", category: "Catering", price: 450 },
];

const AUTO_SEGMENT_SEED = [
  { key: "vip", label: "VIP" },
  { key: "repeat", label: "Repeat" },
  { key: "new", label: "New" },
  { key: "at_risk", label: "At-risk" },
  { key: "dormant", label: "Dormant" },
] as const;

async function seedAutoSegments(
  admin: SupabaseClient,
  businessId: string,
): Promise<void> {
  const rows = AUTO_SEGMENT_SEED.map((s) => ({
    business_id: businessId,
    name: s.label,
    kind: "auto" as const,
    auto_key: s.key,
  }));
  const { error } = await admin
    .from("customer_segments")
    .upsert(rows, { onConflict: "business_id,auto_key", ignoreDuplicates: true });
  if (error) throw new Error(`auto customer_segments: ${error.message}`);
}

async function resolveOwner(admin: SupabaseClient) {
  const email = process.env.SEED_OWNER_EMAIL ?? DEFAULT_OWNER_EMAIL;
  const { data, error } = await admin
    .from("users")
    .select("id, business_id, email")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(`Owner ${email} not found — run: npm run seed`);
  }
  return { userId: data.id as string, businessId: data.business_id as string, email };
}

async function seedCustomers(
  admin: SupabaseClient,
  businessId: string,
  userId: string,
): Promise<string[]> {
  const ids: string[] = [];
  const rows = CUSTOMER_NAMES.map((name, i) => {
    const id = demoUuid("f1000001", i + 1);
    ids.push(id);
    const createdDaysAgo = 15 + i * 5 + (i % 7) * 3;
    const spend = 80 + (i % 12) * 220 + (i % 3) * 500;
    const orders = 1 + (i % 8);
    return {
      id,
      business_id: businessId,
      name,
      phone_e164: `+6012${String(5550100 + i).slice(-7)}`,
      email: `${name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}.demo@example.test`,
      manual_tags: i % 5 === 0 ? ["vip"] : i % 3 === 0 ? ["regular"] : ["new"],
      notes: i % 4 === 0 ? "Good candidate for catering upsell." : null,
      total_spend_myr: spend,
      order_count: orders,
      source: "manual",
      created_at: daysAgoIso(Math.min(createdDaysAgo, DEMO_MONTHS * 30)),
      last_purchase_at: daysAgoIso(i % 45),
      created_by_user_id: userId,
    };
  });
  const { error } = await admin.from("customers").insert(rows);
  if (error) throw new Error(`customers: ${error.message}`);
  console.log(`[seed] ${rows.length} customers`);
  return ids;
}

async function seedMarketing(
  admin: SupabaseClient,
  businessId: string,
  userId: string,
  customerIds: string[],
): Promise<void> {
  const channels = ["tiktok", "instagram", "facebook"] as const;
  const contentRows = Array.from({ length: 24 }, (_, i) => {
    const posted = i % 3 !== 2;
    const daysAgo = 7 + i * 7;
    return {
      id: demoUuid("f2000001", i + 1),
      business_id: businessId,
      channel: channels[i % 3],
      status: posted ? "posted" : "scheduled",
      scheduled_at: posted ? daysAgoIso(daysAgo) : daysAgoIso(-(i % 14)),
      posted_at: posted ? daysAgoIso(daysAgo) : null,
      hook: `Demo post #${i + 1} — ${["Morning rush", "Catering promo", "Behind the kitchen"][i % 3]}`,
      caption: `Fresh nasi lemak & office lunch sets. DM to book. #BantuNiagaDemo #${i + 1}`,
      views: posted ? 400 + i * 37 : 0,
      likes: posted ? 20 + i * 3 : 0,
      comments_count: posted ? i % 9 : 0,
      shares: posted ? i % 5 : 0,
      created_by: userId,
    };
  });
  const { error: cErr } = await admin.from("content_plan").insert(contentRows);
  if (cErr) throw new Error(`content_plan: ${cErr.message}`);

  const customSegmentId = demoUuid("f2000100", 1);
  await seedAutoSegments(admin, businessId);

  const { error: segErr } = await admin.from("customer_segments").upsert(
    {
      id: customSegmentId,
      business_id: businessId,
      name: "Big spenders, last 90 days",
      kind: "custom",
      auto_key: null,
      rules: { min_spend_myr: 500 },
      member_count: customerIds.length > 10 ? 8 : 3,
      member_count_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (segErr) throw new Error(`customer_segments: ${segErr.message}`);

  const validFrom = daysAgoIso(30);
  const validUntil = daysAgoIso(-120);
  const coupons = [
    {
      id: demoUuid("f2000200", 1),
      code: "RAYA20",
      name: "Hari Raya — 20% off",
      type: "PCT",
      value: 20,
      min_subtotal_myr: 50,
    },
    {
      id: demoUuid("f2000200", 2),
      code: "WELCOME10",
      name: "Welcome — RM10 off",
      type: "AMT",
      value: 10,
      min_subtotal_myr: 0,
    },
    {
      id: demoUuid("f2000200", 3),
      code: "CATER15",
      name: "Catering 15% off",
      type: "PCT",
      value: 15,
      min_subtotal_myr: 200,
    },
  ].map((c) => ({
    ...c,
    business_id: businessId,
    status: "active",
    valid_from: validFrom,
    valid_until: validUntil,
    total_limit: null,
    per_customer_limit: 1,
    created_by: userId,
  }));
  const { error: couponErr } = await admin.from("coupons").insert(coupons);
  if (couponErr) throw new Error(`coupons: ${couponErr.message}`);

  const broadcastId = demoUuid("f2000300", 1);
  const recipientCount = 5;
  const { error: bErr } = await admin.from("broadcasts").insert({
    id: broadcastId,
    business_id: businessId,
    name: "July VIP thank-you",
    channel: "whatsapp_ctc",
    status: "sent",
    segment_id: customSegmentId,
    coupon_id: coupons[0]?.id ?? null,
    message_template:
      "Hi {first_name}, thanks for supporting us! Use {coupon_code} this week.",
    total_recipients: recipientCount,
    sent_count: recipientCount,
    failed_count: 0,
    sent_at: daysAgoIso(14),
    created_by: userId,
  });
  if (bErr) throw new Error(`broadcasts: ${bErr.message}`);

  const recipientRows = customerIds.slice(0, recipientCount).map((cid, i) => ({
    broadcast_id: broadcastId,
    customer_id: cid,
    channel_address: `+6012${String(5550100 + i).slice(-7)}`,
    rendered_message:
      "Hi, thanks for supporting us! Use RAYA20 this week.",
    status: "sent",
    sent_at: daysAgoIso(14),
  }));
  const { error: brErr } = await admin
    .from("broadcast_recipients")
    .insert(recipientRows);
  if (brErr) throw new Error(`broadcast_recipients: ${brErr.message}`);

  const events = customerIds.slice(0, 12).map((cid, i) => ({
    id: demoUuid("f2000400", i + 1),
    business_id: businessId,
    name: i % 2 === 0 ? "customer.created" : "customer.updated",
    payload: {
      business_id: businessId,
      customer_id: cid,
      customer_name: CUSTOMER_NAMES[i],
    },
    emitted_at: daysAgoIso(3 + i * 4),
    emitted_by_user_id: userId,
  }));
  const { error: evErr } = await admin.from("events_outbox").insert(events);
  if (evErr) throw new Error(`events_outbox: ${evErr.message}`);

  console.log("[seed] marketing (content, segments, coupons, broadcasts, events)");
}

async function seedSales(
  admin: SupabaseClient,
  businessId: string,
  userId: string,
  productIds: string[],
): Promise<void> {
  const statuses = ["new", "contacted", "interested", "won", "lost"] as const;
  const leads = Array.from({ length: 18 }, (_, i) => ({
    id: demoUuid("f3000001", i + 1),
    business_id: businessId,
    name: `Lead ${CUSTOMER_NAMES[i % CUSTOMER_NAMES.length]}`,
    phone_e164: `+6013${String(7770100 + i).slice(-7)}`,
    channel: ["whatsapp", "instagram", "referral", "walk_in", "call"][i % 5],
    interest: ["Office catering", "Event stall", "Daily packets", "Birthday buffet"][i % 4],
    estimated_value_myr: 300 + i * 150,
    status: statuses[i % statuses.length],
    follow_up_at: i % 4 === 0 ? daysAgoIso(2) : daysAgoIso(-(i % 7)),
    created_by: userId,
    assigned_to: userId,
    created_at: daysAgoIso(10 + i * 8),
  }));
  const { error: leadErr } = await admin.from("sales_leads").insert(leads);
  if (leadErr) throw new Error(`sales_leads: ${leadErr.message}`);

  const notes = leads.slice(0, 6).map((l, i) => ({
    id: demoUuid("f3000100", i + 1),
    business_id: businessId,
    lead_id: l.id,
    body: `Follow-up note ${i + 1}: customer asked for menu PDF.`,
    created_by: userId,
    created_at: daysAgoIso(5 + i),
  }));
  const { error: noteErr } = await admin.from("sales_lead_notes").insert(notes);
  if (noteErr) throw new Error(`sales_lead_notes: ${noteErr.message}`);

  const saleCount = DEMO_MONTHS * 12;
  const sales = [];
  const items = [];
  for (let i = 0; i < saleCount; i++) {
    const saleId = demoUuid("f3000200", i + 1);
    const productIdx = i % productIds.length;
    const qty = 1 + (i % 4);
    const unit = PRODUCT_CATALOG[productIdx]?.price ?? 10;
    const lineTotal = unit * qty;
    const createdAt = daysAgoIso(Math.floor((i / saleCount) * DEMO_MONTHS * 30), 8 + (i % 10));
    sales.push({
      id: saleId,
      business_id: businessId,
      sale_number: `POS-${String(1001 + i)}`,
      subtotal_myr: lineTotal,
      discount_amount_myr: i % 9 === 0 ? 2 : 0,
      sst_amount_myr: 0,
      total_myr: lineTotal - (i % 9 === 0 ? 2 : 0),
      payment_method: i % 3 === 0 ? "duitnow_qr_static" : "cash",
      payment_received_myr: lineTotal,
      change_myr: 0,
      customer_name: CUSTOMER_NAMES[i % CUSTOMER_NAMES.length],
      cashier_user_id: userId,
      status: "completed",
      created_at: createdAt,
      updated_at: createdAt,
    });
    items.push({
      sale_id: saleId,
      business_id: businessId,
      product_id: productIds[productIdx],
      product_name: PRODUCT_CATALOG[productIdx]?.name ?? "Item",
      product_sku: PRODUCT_CATALOG[productIdx]?.sku ?? "SKU",
      unit_price_myr: unit,
      quantity: qty,
      line_total_myr: lineTotal,
      sort_order: 0,
    });
  }
  const { error: saleErr } = await admin.from("pos_sales").insert(sales);
  if (saleErr) throw new Error(`pos_sales: ${saleErr.message}`);
  const { error: itemErr } = await admin.from("pos_sale_items").insert(items);
  if (itemErr) throw new Error(`pos_sale_items: ${itemErr.message}`);

  console.log(`[seed] sales (${leads.length} leads, ${sales.length} POS sales)`);
}

async function seedOperations(
  admin: SupabaseClient,
  businessId: string,
  userId: string,
): Promise<{ productIds: string[]; supplierId: string }> {
  const supplierId = demoUuid("f4000001", 1);
  const { error: supErr } = await admin.from("operations_suppliers").insert({
    id: supplierId,
    business_id: businessId,
    name: "Beras Maju Trading",
    contact_name: "Encik Kamal",
    phone: "+60312345678",
    email: "orders@berasmaju.test",
    payment_terms: "Net 14",
    created_by: userId,
  });
  if (supErr) throw new Error(`operations_suppliers: ${supErr.message}`);

  const productIds: string[] = [];
  const products = PRODUCT_CATALOG.map((p, i) => {
    const id = demoUuid("f4000100", i + 1);
    productIds.push(id);
    return {
      id,
      business_id: businessId,
      sku: p.sku,
      name: p.name,
      category: p.category,
      price_myr: p.price,
      stock_qty: 10 + (i % 5) * 8,
      low_stock_threshold: 5,
      is_active: true,
      created_by: userId,
    };
  });
  const { error: prodErr } = await admin.from("operations_products").insert(products);
  if (prodErr) throw new Error(`operations_products: ${prodErr.message}`);

  const serviceId = demoUuid("f4000200", 1);
  const { error: svcErr } = await admin.from("operations_services").insert({
    id: serviceId,
    business_id: businessId,
    name: "On-site catering setup",
    duration_minutes: 120,
    price_myr: 350,
    is_active: true,
    created_by: userId,
  });
  if (svcErr) throw new Error(`operations_services: ${svcErr.message}`);

  const resourceId = demoUuid("f4000300", 1);
  const { error: resErr } = await admin.from("operations_booking_resources").insert({
    id: resourceId,
    business_id: businessId,
    name: "Main kitchen slot",
    is_active: true,
    created_by: userId,
  });
  if (resErr) throw new Error(`operations_booking_resources: ${resErr.message}`);

  const orderStatuses = ["todo", "in_progress", "ready", "done"] as const;
  const orders = Array.from({ length: 16 }, (_, i) => ({
    id: demoUuid("f4000400", i + 1),
    business_id: businessId,
    number: `ORD-${202600 + i}`,
    customer_name: CUSTOMER_NAMES[i % CUSTOMER_NAMES.length],
    customer_phone: `+6012${String(5550200 + i).slice(-7)}`,
    title: ["Office lunch 30 pax", "Weekend catering", "Custom kuih order", "Corporate tea"][i % 4],
    status: orderStatuses[i % orderStatuses.length],
    due_date: i % 5 === 0 ? daysFromNowYmd(-3) : daysFromNowYmd(i % 20),
    amount_myr: 200 + i * 85,
    supplier_id: i % 3 === 0 ? supplierId : null,
    created_by: userId,
    created_at: daysAgoIso(5 + i * 10),
  }));
  const { error: ordErr } = await admin.from("operations_orders").insert(orders);
  if (ordErr) throw new Error(`operations_orders: ${ordErr.message}`);

  const bookings = Array.from({ length: 10 }, (_, i) => {
    const start = daysAgoIso(-(i * 5 + 2), 10);
    const end = daysAgoIso(-(i * 5 + 2), 12);
    return {
      id: demoUuid("f4000500", i + 1),
      business_id: businessId,
      number: `BK-${300 + i}`,
      customer_name: CUSTOMER_NAMES[(i + 3) % CUSTOMER_NAMES.length],
      service_title: "On-site catering setup",
      resource_id: resourceId,
      starts_at: start,
      ends_at: end,
      status: i % 4 === 0 ? "held" : "confirmed",
      amount_myr: 350,
      created_by: userId,
    };
  });
  const { error: bookErr } = await admin.from("operations_bookings").insert(bookings);
  if (bookErr) throw new Error(`operations_bookings: ${bookErr.message}`);

  console.log("[seed] operations (suppliers, products, orders, bookings)");
  return { productIds, supplierId };
}

async function seedFinance(
  admin: SupabaseClient,
  businessId: string,
  userId: string,
  customerIds: string[],
): Promise<void> {
  const incomeCategories = ["sales", "catering", "other_income"];
  const expenseCategories = ["rent", "utilities", "supplies", "marketing", "payroll"];
  const txns = [];
  for (let m = 0; m < DEMO_MONTHS; m++) {
    for (let w = 0; w < 4; w++) {
      const dayOffset = m * 30 + w * 7 + 2;
      txns.push({
        id: demoUuid("f5000001", m * 4 + w + 1),
        business_id: businessId,
        kind: "income",
        amount_myr: 800 + m * 120 + w * 50,
        category: incomeCategories[w % incomeCategories.length],
        description: `Weekly sales income — month ${m + 1}`,
        payment_method: w % 2 === 0 ? "duitnow" : "cash",
        txn_date: daysAgoIso(dayOffset).slice(0, 10),
        created_by: userId,
      });
      txns.push({
        id: demoUuid("f5000100", m * 4 + w + 1),
        business_id: businessId,
        kind: "expense",
        amount_myr: 150 + m * 20 + w * 15,
        category: expenseCategories[(m + w) % expenseCategories.length],
        description: `Operating expense — month ${m + 1}`,
        payment_method: "bank",
        txn_date: daysAgoIso(dayOffset + 1).slice(0, 10),
        created_by: userId,
      });
    }
  }
  const { error: txErr } = await admin.from("finance_transactions").insert(txns);
  if (txErr) throw new Error(`finance_transactions: ${txErr.message}`);

  const invoices = [];
  const invoiceItems = [];
  for (let i = 0; i < 15; i++) {
    const invId = demoUuid("f5000200", i + 1);
    const amount = 450 + i * 120;
    const status = i % 5 === 0 ? "paid" : i % 4 === 0 ? "sent" : "draft";
    invoices.push({
      id: invId,
      business_id: businessId,
      number: `INV-2026-${String(100 + i)}`,
      share_hash: shareHashFromIndex(i + 1),
      customer_id: customerIds[i % customerIds.length],
      customer_name: CUSTOMER_NAMES[i % CUSTOMER_NAMES.length],
      customer_email: `invoice${i}@example.test`,
      title: `Catering invoice #${i + 1}`,
      document_kind: i % 6 === 0 ? "quote" : "invoice",
      amount_myr: amount,
      tax_myr: 0,
      total_myr: amount,
      status,
      due_date: daysFromNowYmd(i % 14),
      invoice_date: daysAgoIso(20 + i * 8).slice(0, 10),
      paid_at: status === "paid" ? daysAgoIso(5 + i) : null,
      sent_at: status !== "draft" ? daysAgoIso(10 + i) : null,
      created_by: userId,
      created_at: daysAgoIso(25 + i * 8),
    });
    invoiceItems.push({
      id: demoUuid("f5000210", i + 1),
      business_id: businessId,
      invoice_id: invId,
      description: "Catering package",
      unit_price: amount,
      quantity: 1,
      line_total_myr: amount,
      sort_order: 0,
    });
  }
  const { error: invErr } = await admin.from("finance_invoices").insert(invoices);
  if (invErr) throw new Error(`finance_invoices: ${invErr.message}`);
  const { error: itemErr } = await admin
    .from("finance_invoice_items")
    .insert(invoiceItems);
  if (itemErr) throw new Error(`finance_invoice_items: ${itemErr.message}`);

  console.log(`[seed] finance (${txns.length} transactions, ${invoices.length} invoices)`);
}

async function seedHr(
  admin: SupabaseClient,
  businessId: string,
  userId: string,
): Promise<void> {
  const employees = [
    { name: "Aisyah Rahman", role: "Cafe Supervisor", type: "full_time" },
    { name: "Daniel Tan", role: "Sales Assistant", type: "full_time" },
    { name: "Nurul Izzah", role: "Kitchen Crew", type: "part_time" },
    { name: "Hafiz Ismail", role: "Delivery Runner", type: "contract" },
    { name: "Michelle Yeoh", role: "Finance Clerk", type: "full_time" },
    { name: "Arif Bin Kamal", role: "Barista", type: "part_time" },
  ];
  const employeeIds: string[] = [];
  const empRows = employees.map((e, i) => {
    const id = demoUuid("f6000001", i + 1);
    employeeIds.push(id);
    return {
      id,
      business_id: businessId,
      full_name: e.name,
      employment_type: e.type,
      role_title: e.role,
      start_date: daysAgoIso(120 + i * 20).slice(0, 10),
      status: "active",
      identity_type: "ic",
      identity_number: `90010${i}-14-${5678 + i}`,
      phone_e164: `+6012345${6700 + i}`,
      email: `${e.name.split(" ")[0].toLowerCase()}@example.test`,
      annual_leave_entitlement_days: 12,
      created_by: userId,
    };
  });
  const { error: empErr } = await admin.from("hr_employees").insert(empRows);
  if (empErr) throw new Error(`hr_employees: ${empErr.message}`);

  const leaveRows = employeeIds.flatMap((empId, i) => [
    {
      id: demoUuid("f6000100", i * 2 + 1),
      business_id: businessId,
      employee_id: empId,
      leave_type: "annual",
      start_date: daysFromNowYmd(5 + i),
      end_date: daysFromNowYmd(7 + i),
      reason: "Family trip",
      status: "pending",
    },
    {
      id: demoUuid("f6000100", i * 2 + 2),
      business_id: businessId,
      employee_id: empId,
      leave_type: "mc",
      start_date: daysAgoIso(10 + i).slice(0, 10),
      end_date: daysAgoIso(10 + i).slice(0, 10),
      reason: "Clinic MC",
      status: i % 2 === 0 ? "approved" : "pending",
      decided_at: i % 2 === 0 ? daysAgoIso(9 + i) : null,
    },
  ]);
  const { error: leaveErr } = await admin.from("hr_leave_records").insert(leaveRows);
  if (leaveErr) throw new Error(`hr_leave_records: ${leaveErr.message}`);

  const year = new Date().getFullYear();
  const balances = employeeIds.map((empId, i) => ({
    business_id: businessId,
    employee_id: empId,
    leave_year: year,
    entitlement_days: 12,
    taken_days: i % 4,
  }));
  const { error: balErr } = await admin.from("hr_leave_balances").insert(balances);
  if (balErr) throw new Error(`hr_leave_balances: ${balErr.message}`);

  const holidays = [
    { date: daysFromNowYmd(30), name: "Demo company family day" },
    { date: daysFromNowYmd(60), name: "Kitchen maintenance closure" },
  ].map((h, i) => ({
    id: demoUuid("f6000200", i + 1),
    business_id: businessId,
    state_code: "KUL",
    holiday_date: h.date,
    name: h.name,
  }));
  const { error: holErr } = await admin.from("hr_public_holidays").insert(holidays);
  if (holErr) throw new Error(`hr_public_holidays: ${holErr.message}`);

  console.log(`[seed] HR (${empRows.length} employees, leave, holidays)`);
}

async function seedAdmin(
  admin: SupabaseClient,
  businessId: string,
  userId: string,
): Promise<void> {
  const columnDefs = [
    { id: demoUuid("f7000050", 1), label: "To do", slug: "todo", sort_order: 0, is_done: false },
    { id: demoUuid("f7000050", 2), label: "Doing", slug: "doing", sort_order: 1, is_done: false },
    { id: demoUuid("f7000050", 3), label: "Done", slug: "done", sort_order: 2, is_done: true },
  ];
  const { error: colErr } = await admin.from("admin_task_columns").insert(
    columnDefs.map((c) => ({ ...c, business_id: businessId })),
  );
  if (colErr) throw new Error(`admin_task_columns: ${colErr.message}`);

  const columnIds = columnDefs.map((c) => c.id);
  const tasks = Array.from({ length: 12 }, (_, i) => ({
    id: demoUuid("f7000001", i + 1),
    business_id: businessId,
    title: [
      "Renew SSM registration",
      "Update food handler certs",
      "Review supplier contracts",
      "Prepare Q3 compliance folder",
      "Archive old receipts",
    ][i % 5],
    description: "Demo admin task for AI briefing.",
    column_id: columnIds[i % 3],
    due_date: daysFromNowYmd(i % 21),
    assignee_user_id: userId,
    created_by: userId,
    sort_order: i,
    completed_at: i % 3 === 2 ? daysAgoIso(3 + i) : null,
    created_at: daysAgoIso(20 + i * 5),
  }));
  const { error: taskErr } = await admin.from("admin_tasks").insert(tasks);
  if (taskErr) throw new Error(`admin_tasks: ${taskErr.message}`);

  const compliance = [
    { title: "SSM Business Registration", category: "ssm", days: 45 },
    { title: "DBKL Signboard Licence", category: "dbkl", days: 90 },
    { title: "Halal Certificate", category: "halal", days: 120 },
    { title: "Public Liability Insurance", category: "insurance", days: 200 },
  ].map((c, i) => ({
    id: demoUuid("f7000100", i + 1),
    business_id: businessId,
    title: c.title,
    category: c.category,
    authority: "Demo authority",
    reference_number: `REF-2026-${100 + i}`,
    expires_on: daysFromNowYmd(c.days),
    status: "active",
    created_by: userId,
  }));
  const { error: compErr } = await admin
    .from("admin_compliance_items")
    .insert(compliance);
  if (compErr) throw new Error(`admin_compliance_items: ${compErr.message}`);

  console.log("[seed] admin (tasks, compliance)");
}

async function seedBoardroomAndAgents(
  admin: SupabaseClient,
  businessId: string,
  userId: string,
): Promise<void> {
  const meetingId = demoUuid("f8000001", 1);
  const { error: meetErr } = await admin.from("boardroom_meetings").insert({
    id: meetingId,
    business_id: businessId,
    created_by: userId,
    status: "ended",
    invited_agent_ids: ["marketing", "finance", "operations", "sales"],
    title: "Q2 review — demo",
    credits_spent: 12,
    created_at: daysAgoIso(7),
    ended_at: daysAgoIso(7),
  });
  if (meetErr) throw new Error(`boardroom_meetings: ${meetErr.message}`);

  const messages = [
    { role: "user", content: "What should we focus on this month?" },
    {
      role: "agent",
      agent_id: "marketing",
      content: "VIP segment is flat — run a win-back broadcast with CATER15.",
    },
    {
      role: "agent",
      agent_id: "finance",
      content: "Outstanding invoices total RM 4.2k — chase 3 sent invoices.",
    },
    { role: "synth", content: "Priority: (1) invoice follow-ups (2) VIP campaign (3) overdue ops orders." },
  ].map((m, i) => ({
    id: demoUuid("f8000100", i + 1),
    business_id: businessId,
    meeting_id: meetingId,
    role: m.role,
    agent_id: "agent_id" in m ? m.agent_id : null,
    content: m.content,
    created_at: daysAgoIso(7, 10 + i),
  }));
  const { error: msgErr } = await admin.from("boardroom_messages").insert(messages);
  if (msgErr) throw new Error(`boardroom_messages: ${msgErr.message}`);

  const agents = [
    "hr",
    "admin",
    "marketing",
    "finance",
    "operations",
    "sales",
  ].map((slug) => ({
    business_id: businessId,
    agent_slug: slug,
    display_name:
      slug === "hr"
        ? "Hana"
        : slug === "admin"
          ? "Amir"
          : slug === "marketing"
            ? "Maya"
            : slug === "finance"
              ? "Fayza"
              : slug === "operations"
                ? "Aiman"
                : "Sufi",
    assistant_enabled: true,
    daily_notice_enabled: true,
    daily_notice_hour: 8,
    reasoning_mode: "fast",
  }));
  const { error: agentErr } = await admin
    .from("business_agent_settings")
    .upsert(agents, { onConflict: "business_id,agent_slug" });
  if (agentErr) throw new Error(`business_agent_settings: ${agentErr.message}`);

  const { data: addonCatalog } = await admin
    .from("marketplace_addons")
    .select("id, slug")
    .in("slug", [
      "hr-assistant",
      "admin-assistant",
      "marketing-assistant",
      "finance-assistant",
      "operations-assistant",
      "sales-assistant",
      "boardroom-weekly",
    ]);
  if (addonCatalog?.length) {
    const { error: addonErr } = await admin.from("business_addons").insert(
      addonCatalog.map((addon) => ({
        business_id: businessId,
        addon_id: addon.id,
        status: "active",
        qty: 1,
        meta: { seeded: true, source: "reset-and-seed-demo" },
      })),
    );
    if (addonErr) throw new Error(`business_addons: ${addonErr.message}`);
  }

  await admin
    .from("businesses")
    .update({
      credit_balance: tierBundledCredits("enterprise"),
      onboarding_completed_at: daysAgoIso(200),
    })
    .eq("id", businessId);

  const policyVersion = process.env.PRIVACY_POLICY_VERSION ?? "2026-06-14";
  await admin.from("user_consents").upsert(
    [
      {
        user_id: userId,
        business_id: businessId,
        kind: "terms_of_service",
        granted: true,
        policy_version: policyVersion,
        granted_at: daysAgoIso(200),
      },
      {
        user_id: userId,
        business_id: businessId,
        kind: "privacy_notice",
        granted: true,
        policy_version: policyVersion,
        granted_at: daysAgoIso(200),
      },
    ],
    { onConflict: "user_id,kind" },
  );

  console.log("[seed] boardroom, agents, credits");
}

async function main(): Promise<void> {
  loadDotEnvLocal();
  const admin = createServiceAdmin();

  console.log("\n=== Bantu Niaga Demo Reset & Seed ===\n");

  console.log("[1/4] Reset owner account (npm run seed)…");
  execSync("npm run seed", { stdio: "inherit", cwd: process.cwd() });

  const owner = await resolveOwner(admin);
  const businessId = owner.businessId;
  console.log(`\n[2/4] Purge tenant data for ${businessId}…`);
  await purgeDemoBusinessData(admin, businessId);

  console.log("\n[3/4] Seed 6 months of cross-module data…");
  const customerIds = await seedCustomers(admin, businessId, owner.userId);
  const { productIds } = await seedOperations(admin, businessId, owner.userId);
  await seedMarketing(admin, businessId, owner.userId, customerIds);
  await seedSales(admin, businessId, owner.userId, productIds);
  await seedFinance(admin, businessId, owner.userId, customerIds);
  await seedHr(admin, businessId, owner.userId);
  await seedAdmin(admin, businessId, owner.userId);
  await seedAdminStorage(admin, businessId, owner.userId);
  await seedBoardroomAndAgents(admin, businessId, owner.userId);

  console.log("\n[4/4] Done.\n");
  console.log("Sign in: http://localhost:3000/sign-in");
  console.log(`  email:    ${owner.email}`);
  console.log(
    `  password: ${process.env.SEED_OWNER_PASSWORD ?? DEFAULT_OWNER_PASSWORD}`,
  );
  console.log(`  business: Bantu Niaga Demo SDN BHD (${businessId})`);
  console.log(`  window:   ~${DEMO_MONTHS} months of seeded activity\n`);
}

main().catch((err) => {
  console.error(
    "\n[demo:reset] failed:",
    err instanceof Error ? err.message : err,
  );
  process.exitCode = 1;
});
