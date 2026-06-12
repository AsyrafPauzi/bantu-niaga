/**
 * Bantu Niaga — Marketing M6 KPI snapshot integration tests.
 *
 * Verifies the `marketing_kpi_snapshot(p_business_id)` RPC + the
 * `customer_analytics_v1` view (mission F-B) return per-business
 * counts consistent with the seed across two isolated businesses,
 * matching what the `/marketing` landing page renders.
 *
 * Seeds customers with varied `auto_tags` arrays directly (no event
 * pipeline involvement — we're asserting the aggregation, not the
 * upstream metric refresh). Self-skips when the live-DB env vars are
 * absent.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  coerceKpiSnapshot,
  type KpiSnapshotRaw,
} from "@/lib/marketing/metrics";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENABLED = Boolean(URL_ && SERVICE);

interface SeedSpec {
  label: string;
  auto_tags: string[];
  total_spend_myr?: number;
  order_count?: number;
  /** Optional override for created_at (used to test new_this_month). */
  created_days_ago?: number;
  /** If true, customer is soft-deleted post-insert. */
  soft_delete?: boolean;
  /** If true, merge this customer into another (set after insert). */
  merge_into_label?: string;
}

interface Seeded {
  id: string;
  label: string;
  business: "A" | "B";
}

interface Fixture {
  service: SupabaseClient;
  bizA: string;
  bizB: string;
  seeded: Seeded[];
  /**
   * Expected KPI counts per business after seed — computed
   * deterministically from the seed specs.
   */
  expectedA: {
    total: number;
    vip: number;
    dormant: number;
    at_risk: number;
    repeat: number;
    new: number;
  };
  expectedB: {
    total: number;
    vip: number;
    dormant: number;
    at_risk: number;
    repeat: number;
    new: number;
  };
}

let fixture: Fixture | null = null;

async function seedBusiness(svc: SupabaseClient, label: string): Promise<string> {
  const id = randomUUID();
  const { error } = await svc.from("businesses").insert({
    id,
    idcompany: `m6kpi-${label}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    name: `M6 KPI fixture ${label}`,
    tier: "micro",
  });
  if (error) throw new Error(`seed biz ${label}: ${error.message}`);
  return id;
}

async function insertCustomer(
  svc: SupabaseClient,
  bizId: string,
  spec: SeedSpec,
): Promise<string> {
  const { data, error } = await svc
    .from("customers")
    .insert({
      business_id: bizId,
      name: spec.label,
      auto_tags: spec.auto_tags,
      total_spend_myr: spec.total_spend_myr ?? 0,
      order_count: spec.order_count ?? 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`insert customer ${spec.label}: ${error.message}`);
  return data!.id as string;
}

const SEED_A: SeedSpec[] = [
  // 5 total live customers in biz A:
  { label: "A_new",       auto_tags: ["new"],            order_count: 1,  total_spend_myr: 50 },
  { label: "A_repeat",    auto_tags: ["repeat"],          order_count: 4,  total_spend_myr: 250 },
  { label: "A_vip",       auto_tags: ["vip", "repeat"],   order_count: 5,  total_spend_myr: 2500 },
  { label: "A_dormant",   auto_tags: ["dormant"],         order_count: 1,  total_spend_myr: 80 },
  { label: "A_at_risk",   auto_tags: ["repeat", "at-risk"], order_count: 4, total_spend_myr: 320 },
  // Two extras that should be EXCLUDED from the KPIs (merged + soft-deleted):
  { label: "A_merged_away", auto_tags: ["vip"],           order_count: 12, total_spend_myr: 5000, merge_into_label: "A_vip" },
  { label: "A_soft_deleted", auto_tags: ["dormant"],      order_count: 1,  total_spend_myr: 10,   soft_delete: true },
];

const SEED_B: SeedSpec[] = [
  { label: "B_vip_repeat", auto_tags: ["vip", "repeat"], order_count: 6, total_spend_myr: 2000 },
  { label: "B_dormant",    auto_tags: ["dormant"],        order_count: 1, total_spend_myr: 80 },
];

beforeAll(async () => {
  if (!ENABLED) return;
  const service = createClient(URL_!, SERVICE!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const bizA = await seedBusiness(service, "a");
  const bizB = await seedBusiness(service, "b");

  const seeded: Seeded[] = [];
  const bizASpecsByLabel = new Map<string, string>();
  for (const spec of SEED_A) {
    const id = await insertCustomer(service, bizA, spec);
    bizASpecsByLabel.set(spec.label, id);
    seeded.push({ id, label: spec.label, business: "A" });
  }
  for (const spec of SEED_B) {
    const id = await insertCustomer(service, bizB, spec);
    seeded.push({ id, label: spec.label, business: "B" });
  }

  // Resolve merge / soft-delete side effects from the spec.
  for (const spec of SEED_A) {
    if (spec.merge_into_label) {
      const survivor = bizASpecsByLabel.get(spec.merge_into_label);
      const merged = bizASpecsByLabel.get(spec.label);
      if (!survivor || !merged) continue;
      const { error } = await service
        .from("customers")
        .update({ merged_into_id: survivor })
        .eq("id", merged);
      if (error) throw new Error(`merge ${spec.label}: ${error.message}`);
    }
    if (spec.soft_delete) {
      const id = bizASpecsByLabel.get(spec.label);
      if (!id) continue;
      const { error } = await service
        .from("customers")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(`soft-delete ${spec.label}: ${error.message}`);
    }
  }

  fixture = {
    service,
    bizA,
    bizB,
    seeded,
    expectedA: {
      total: 5,
      vip: 1,
      dormant: 1,
      at_risk: 1,
      repeat: 3,
      new: 1,
    },
    expectedB: {
      total: 2,
      vip: 1,
      dormant: 1,
      at_risk: 0,
      repeat: 1,
      new: 0,
    },
  };
}, 90_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;
  const ids = fixture.seeded.map((s) => s.id);
  if (ids.length > 0) {
    await svc.from("customers").delete().in("id", ids);
  }
  await svc.from("businesses").delete().in("id", [fixture.bizA, fixture.bizB]);
}, 60_000);

describe.runIf(ENABLED)("M6 — KPI snapshot RPC", () => {
  it("business A: counts match the seed (excluding merged + soft-deleted)", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;
    const { data, error } = await svc.rpc("marketing_kpi_snapshot", {
      p_business_id: fixture.bizA,
    });
    expect(error).toBeNull();
    const raw = Array.isArray(data)
      ? ((data[0] as KpiSnapshotRaw | undefined) ?? null)
      : ((data as KpiSnapshotRaw | null) ?? null);
    const snap = coerceKpiSnapshot(raw);

    expect(snap.total_customers).toBe(fixture.expectedA.total);
    expect(snap.vip_count).toBe(fixture.expectedA.vip);
    expect(snap.dormant_count).toBe(fixture.expectedA.dormant);
    expect(snap.at_risk_count).toBe(fixture.expectedA.at_risk);
    expect(snap.repeat_count).toBe(fixture.expectedA.repeat);
    expect(snap.new_count).toBe(fixture.expectedA.new);
    // new_this_month should be ≥ total_customers since all seeded
    // customers were just inserted.
    expect(snap.new_this_month).toBeGreaterThanOrEqual(
      fixture.expectedA.total,
    );
    expect(snap.new_this_month).toBeLessThanOrEqual(
      fixture.expectedA.total,
    );
    // Total spend = sum across live, un-merged customers in A.
    const liveSum =
      50 + // A_new
      250 + // A_repeat
      2500 + // A_vip
      80 + // A_dormant
      320; // A_at_risk
    expect(snap.total_spend_myr_sum).toBeCloseTo(liveSum, 2);
  });

  it("business B: counts isolated from business A", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;
    const { data, error } = await svc.rpc("marketing_kpi_snapshot", {
      p_business_id: fixture.bizB,
    });
    expect(error).toBeNull();
    const raw = Array.isArray(data)
      ? ((data[0] as KpiSnapshotRaw | undefined) ?? null)
      : ((data as KpiSnapshotRaw | null) ?? null);
    const snap = coerceKpiSnapshot(raw);

    expect(snap.total_customers).toBe(fixture.expectedB.total);
    expect(snap.vip_count).toBe(fixture.expectedB.vip);
    expect(snap.dormant_count).toBe(fixture.expectedB.dormant);
    expect(snap.at_risk_count).toBe(fixture.expectedB.at_risk);
    expect(snap.repeat_count).toBe(fixture.expectedB.repeat);
    expect(snap.new_count).toBe(fixture.expectedB.new);
  });

  it("business with no customers returns zeros (RPC degrades gracefully)", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;
    // Use a definitely-non-existent business id.
    const ghostId = randomUUID();
    const { data, error } = await svc.rpc("marketing_kpi_snapshot", {
      p_business_id: ghostId,
    });
    expect(error).toBeNull();
    const raw = Array.isArray(data)
      ? ((data[0] as KpiSnapshotRaw | undefined) ?? null)
      : ((data as KpiSnapshotRaw | null) ?? null);
    const snap = coerceKpiSnapshot(raw);
    expect(snap.total_customers).toBe(0);
    expect(snap.vip_count).toBe(0);
    expect(snap.dormant_count).toBe(0);
    expect(snap.at_risk_count).toBe(0);
    expect(snap.repeat_count).toBe(0);
    expect(snap.new_count).toBe(0);
    expect(snap.new_this_month).toBe(0);
    expect(snap.total_spend_myr_sum).toBe(0);
    expect(snap.avg_aov_myr).toBe(0);
  });
});

describe.runIf(ENABLED)("M6 — customer_analytics_v1 view", () => {
  it("exposes one row per business with same counts as the RPC", async () => {
    if (!fixture) throw new Error("fixture missing");
    const svc = fixture.service;
    const { data, error } = await svc
      .from("customer_analytics_v1")
      .select("*")
      .in("business_id", [fixture.bizA, fixture.bizB]);
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<{
      business_id: string;
      total_customers: number;
      vip_count: number;
      dormant_count: number;
      at_risk_count: number;
      repeat_count: number;
      new_count: number;
    }>;
    expect(rows.length).toBe(2);
    const rowA = rows.find((r) => r.business_id === fixture!.bizA);
    const rowB = rows.find((r) => r.business_id === fixture!.bizB);
    expect(rowA?.total_customers).toBe(fixture.expectedA.total);
    expect(rowA?.vip_count).toBe(fixture.expectedA.vip);
    expect(rowA?.dormant_count).toBe(fixture.expectedA.dormant);
    expect(rowA?.at_risk_count).toBe(fixture.expectedA.at_risk);
    expect(rowA?.repeat_count).toBe(fixture.expectedA.repeat);
    expect(rowA?.new_count).toBe(fixture.expectedA.new);
    expect(rowB?.total_customers).toBe(fixture.expectedB.total);
    expect(rowB?.vip_count).toBe(fixture.expectedB.vip);
    expect(rowB?.dormant_count).toBe(fixture.expectedB.dormant);
    expect(rowB?.at_risk_count).toBe(fixture.expectedB.at_risk);
    expect(rowB?.repeat_count).toBe(fixture.expectedB.repeat);
    expect(rowB?.new_count).toBe(fixture.expectedB.new);
  });
});
