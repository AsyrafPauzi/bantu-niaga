/**
 * Bantu Niaga — Marketing M4 integration tests.
 *
 * Exercises the SQL pipeline end-to-end against the live remote
 * Supabase project (defense-in-depth alongside the pure-TS
 * `auto-tags-compute.test.ts`):
 *
 *   1. SQL `marketing_compute_auto_tags(...)` agrees with the TS
 *      `computeAutoTags(...)` for the same snapshot (sanity check).
 *
 *   2. `marketing_apply_auto_tags_all()` populates `auto_tags` on every
 *      seeded customer with the expected set. Outbox event count =
 *      number of customers whose computed tags differ from `{}`.
 *
 *   3. Idempotency: a second back-to-back run produces zero new
 *      `customer.tag_changed` outbox rows.
 *
 *   4. Tenant isolation: business B's customer rows are untouched
 *      when only business A is processed via `marketing_apply_auto_tags`.
 *
 * Self-skips when the env vars to reach the live project are absent.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { computeAutoTags } from "@/lib/marketing/auto-tags";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENABLED = Boolean(URL_ && SERVICE);

interface Fixture {
  bizA: string;
  bizB: string;
  service: SupabaseClient;
  customers: Array<{
    id: string;
    business: "A" | "B";
    label: string;
    expectedTags: string[];
  }>;
}

let fixture: Fixture | null = null;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function seedBusiness(svc: SupabaseClient, label: string): Promise<string> {
  const id = randomUUID();
  const { error } = await svc.from("businesses").insert({
    id,
    idcompany: `m4-${label}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    name: `M4 fixture ${label}`,
    tier: "micro",
  });
  if (error) throw new Error(`seed biz ${label}: ${error.message}`);
  return id;
}

async function insertCustomer(
  svc: SupabaseClient,
  bizId: string,
  fields: {
    label: string;
    order_count: number;
    total_spend_myr: number;
    last_purchase_at: string | null;
    created_at?: string;
  },
): Promise<string> {
  const { data, error } = await svc
    .from("customers")
    .insert({
      business_id: bizId,
      name: fields.label,
      order_count: fields.order_count,
      total_spend_myr: fields.total_spend_myr,
      last_purchase_at: fields.last_purchase_at,
    })
    .select("id, created_at")
    .single();
  if (error) throw new Error(`insert customer ${fields.label}: ${error.message}`);
  return data!.id as string;
}

beforeAll(async () => {
  if (!ENABLED) return;
  const service = createClient(URL_!, SERVICE!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const bizA = await seedBusiness(service, "a");
  const bizB = await seedBusiness(service, "b");

  const profiles: Array<{
    label: string;
    business: "A" | "B";
    order_count: number;
    total_spend_myr: number;
    last_purchase_at: string | null;
  }> = [
    // ── Business A: 8 fixtures spanning every tag combination
    { label: "A-new-buyer",        business: "A", order_count: 1,  total_spend_myr: 50,   last_purchase_at: daysAgoIso(5) },
    { label: "A-repeat-recent",    business: "A", order_count: 4,  total_spend_myr: 250,  last_purchase_at: daysAgoIso(10) },
    { label: "A-vip-spend",        business: "A", order_count: 1,  total_spend_myr: 1500, last_purchase_at: daysAgoIso(7) },
    { label: "A-vip-by-count",     business: "A", order_count: 12, total_spend_myr: 400,  last_purchase_at: daysAgoIso(15) },
    { label: "A-vip-repeat",       business: "A", order_count: 5,  total_spend_myr: 2500, last_purchase_at: daysAgoIso(10) },
    { label: "A-at-risk-repeat",   business: "A", order_count: 4,  total_spend_myr: 300,  last_purchase_at: daysAgoIso(75) },
    { label: "A-dormant-vip",      business: "A", order_count: 5,  total_spend_myr: 2500, last_purchase_at: daysAgoIso(120) },
    { label: "A-no-purchase",      business: "A", order_count: 0,  total_spend_myr: 0,    last_purchase_at: null },
    // ── Business B: 2 fixtures for tenant-isolation check
    { label: "B-vip-repeat",       business: "B", order_count: 6,  total_spend_myr: 2000, last_purchase_at: daysAgoIso(20) },
    { label: "B-dormant",          business: "B", order_count: 1,  total_spend_myr: 80,   last_purchase_at: daysAgoIso(150) },
  ];

  const customers: Fixture["customers"] = [];
  const now = new Date();
  for (const p of profiles) {
    const bizId = p.business === "A" ? bizA : bizB;
    const id = await insertCustomer(service, bizId, p);
    const expected = computeAutoTags(
      {
        created_at: null,
        order_count: p.order_count,
        total_spend_myr: p.total_spend_myr,
        last_purchase_at: p.last_purchase_at,
      },
      now,
    );
    customers.push({
      id,
      business: p.business,
      label: p.label,
      expectedTags: expected,
    });
  }

  fixture = { bizA, bizB, service, customers };
}, 90_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;
  const customerIds = fixture.customers.map((c) => c.id);
  if (customerIds.length > 0) {
    await svc.from("customer_tag_history").delete().in("customer_id", customerIds);
    await svc.from("events_outbox").delete().in("business_id", [fixture.bizA, fixture.bizB]);
    await svc.from("customers").delete().in("id", customerIds);
  }
  await svc.from("businesses").delete().in("id", [fixture.bizA, fixture.bizB]);
}, 60_000);

describe.runIf(ENABLED)("M4 — SQL compute parity with TS", () => {
  it("SQL marketing_compute_auto_tags matches TS computeAutoTags for every fixture", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;
    for (const c of fixture.customers) {
      const { data: row, error } = await svc
        .from("customers")
        .select("created_at, order_count, total_spend_myr, last_purchase_at")
        .eq("id", c.id)
        .single();
      expect(error).toBeNull();
      const { data: sqlResult, error: rpcErr } = await svc.rpc(
        "marketing_compute_auto_tags",
        {
          p_created_at: row!.created_at,
          p_order_count: row!.order_count,
          p_total_spend: row!.total_spend_myr,
          p_last_purchase_at: row!.last_purchase_at,
        },
      );
      expect(rpcErr).toBeNull();
      const sqlTags = (sqlResult ?? []) as string[];
      const tsTags = computeAutoTags(
        {
          created_at: row!.created_at,
          order_count: row!.order_count as number,
          total_spend_myr: row!.total_spend_myr as number,
          last_purchase_at: row!.last_purchase_at,
        },
        new Date(),
      );
      expect(sqlTags, `SQL vs TS mismatch on ${c.label}`).toEqual(tsTags);
    }
  });
});

describe.runIf(ENABLED)("M4 — marketing_apply_auto_tags_all", () => {
  it("populates auto_tags + emits one outbox event per transition", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;

    // Capture starting outbox count for both businesses scoped to
    // customer.tag_changed (so the assertion is robust against any
    // ambient noise from other tests).
    const { count: priorOutbox } = await svc
      .from("events_outbox")
      .select("id", { count: "exact", head: true })
      .in("business_id", [fixture.bizA, fixture.bizB])
      .eq("name", "customer.tag_changed");
    const startOutbox = priorOutbox ?? 0;

    const { data, error } = await svc.rpc("marketing_apply_auto_tags_all");
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<{
      business_id: string;
      updated_count: number | null;
      transitions_count: number | null;
      error_message: string | null;
    }>;

    // Both businesses processed without error.
    const aRow = rows.find((r) => r.business_id === fixture!.bizA);
    const bRow = rows.find((r) => r.business_id === fixture!.bizB);
    expect(aRow?.error_message).toBeNull();
    expect(bRow?.error_message).toBeNull();

    // Customer counts match the seed.
    expect(aRow!.updated_count).toBe(
      fixture!.customers.filter((c) => c.business === "A").length,
    );
    expect(bRow!.updated_count).toBe(
      fixture!.customers.filter((c) => c.business === "B").length,
    );

    // Transitions = customers whose expected tags are non-empty.
    const expectedTransitionsA = fixture!.customers.filter(
      (c) => c.business === "A" && c.expectedTags.length > 0,
    ).length;
    const expectedTransitionsB = fixture!.customers.filter(
      (c) => c.business === "B" && c.expectedTags.length > 0,
    ).length;
    expect(aRow!.transitions_count).toBe(expectedTransitionsA);
    expect(bRow!.transitions_count).toBe(expectedTransitionsB);

    // Outbox: one row per transition.
    const { count: afterOutbox } = await svc
      .from("events_outbox")
      .select("id", { count: "exact", head: true })
      .in("business_id", [fixture.bizA, fixture.bizB])
      .eq("name", "customer.tag_changed");
    expect((afterOutbox ?? 0) - startOutbox).toBe(
      expectedTransitionsA + expectedTransitionsB,
    );

    // Each customer's stored auto_tags now matches the expectation.
    for (const c of fixture!.customers) {
      const { data: row } = await svc
        .from("customers")
        .select("auto_tags")
        .eq("id", c.id)
        .single();
      const stored = ((row?.auto_tags ?? []) as string[]).slice().sort();
      expect(stored, `auto_tags mismatch on ${c.label}`).toEqual(c.expectedTags);
    }
  });

  it("is idempotent — a second run produces zero new outbox events", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;

    const { count: priorOutbox } = await svc
      .from("events_outbox")
      .select("id", { count: "exact", head: true })
      .in("business_id", [fixture.bizA, fixture.bizB])
      .eq("name", "customer.tag_changed");
    const start = priorOutbox ?? 0;

    const { data, error } = await svc.rpc("marketing_apply_auto_tags_all");
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<{
      business_id: string;
      updated_count: number | null;
      transitions_count: number | null;
      error_message: string | null;
    }>;
    for (const r of rows) {
      expect(r.error_message).toBeNull();
      // Some transitions may legitimately be > 0 if other businesses
      // exist in the live project — restrict the idempotency check to
      // OUR two businesses.
      if (r.business_id === fixture!.bizA || r.business_id === fixture!.bizB) {
        expect(
          r.transitions_count,
          `expected zero transitions in business ${r.business_id} on second run`,
        ).toBe(0);
      }
    }

    const { count: afterOutbox } = await svc
      .from("events_outbox")
      .select("id", { count: "exact", head: true })
      .in("business_id", [fixture.bizA, fixture.bizB])
      .eq("name", "customer.tag_changed");
    expect(afterOutbox ?? 0).toBe(start);
  });
});

describe.runIf(ENABLED)("M4 — tenant isolation", () => {
  it("marketing_apply_auto_tags(business_a) does not mutate business_b customer rows", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;

    // Snapshot business B's auto_tags first.
    const bCustomers = fixture.customers.filter((c) => c.business === "B");
    const before = new Map<string, string[]>();
    for (const c of bCustomers) {
      const { data } = await svc
        .from("customers")
        .select("auto_tags, updated_at")
        .eq("id", c.id)
        .single();
      before.set(c.id, ((data?.auto_tags ?? []) as string[]).slice().sort());
    }

    // Wipe A's auto_tags so a re-apply produces transitions only on A.
    await svc
      .from("customers")
      .update({ auto_tags: [] })
      .eq("business_id", fixture.bizA);

    // Run apply for biz A only.
    const { data, error } = await svc.rpc("marketing_apply_auto_tags", {
      p_business_id: fixture.bizA,
    });
    expect(error).toBeNull();
    const result = Array.isArray(data) ? data[0] : data;
    const aRow = result as { updated_count: number; transitions_count: number } | null;
    expect(aRow?.updated_count).toBe(
      fixture.customers.filter((c) => c.business === "A").length,
    );

    // Business B unchanged.
    for (const c of bCustomers) {
      const { data } = await svc
        .from("customers")
        .select("auto_tags")
        .eq("id", c.id)
        .single();
      const after = ((data?.auto_tags ?? []) as string[]).slice().sort();
      expect(after, `B customer ${c.label} drifted`).toEqual(before.get(c.id));
    }
  });
});
