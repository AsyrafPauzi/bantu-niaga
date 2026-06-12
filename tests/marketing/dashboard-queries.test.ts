/**
 * Bantu Niaga — dashboard-queries.ts integration test.
 *
 * Self-skips when the live-DB env vars are absent. When they are
 * present, seeds two isolated businesses with a small fixture and
 * asserts `getKpiSnapshot` (the public dashboard wrapper) returns the
 * camelCase shape with the right counts.
 *
 * Mirrors the seeding pattern in api-marketing-kpis.test.ts so the
 * RLS / tenant-scoping invariants stay locked in.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { getKpiSnapshot } from "@/lib/marketing/dashboard-queries";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENABLED = Boolean(URL_ && SERVICE);

interface Fixture {
  service: SupabaseClient;
  bizA: string;
  bizB: string;
  customerIds: string[];
}

let fixture: Fixture | null = null;

async function seedBusiness(svc: SupabaseClient, label: string): Promise<string> {
  const id = randomUUID();
  const { error } = await svc.from("businesses").insert({
    id,
    idcompany: `dq-${label}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    name: `Dashboard query fixture ${label}`,
    tier: "micro",
  });
  if (error) throw new Error(`seed biz ${label}: ${error.message}`);
  return id;
}

async function insertCustomer(
  svc: SupabaseClient,
  bizId: string,
  name: string,
  autoTags: string[],
  totalSpend: number,
  orderCount: number,
): Promise<string> {
  const { data, error } = await svc
    .from("customers")
    .insert({
      business_id: bizId,
      name,
      auto_tags: autoTags,
      total_spend_myr: totalSpend,
      order_count: orderCount,
    })
    .select("id")
    .single();
  if (error) throw new Error(`insert ${name}: ${error.message}`);
  return data!.id as string;
}

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

  const customerIds: string[] = [];
  customerIds.push(await insertCustomer(service, bizA, "DQ-A-vip",     ["vip", "repeat"], 2500, 5));
  customerIds.push(await insertCustomer(service, bizA, "DQ-A-repeat",  ["repeat"],         400,  3));
  customerIds.push(await insertCustomer(service, bizA, "DQ-A-new",     ["new"],            50,   1));
  customerIds.push(await insertCustomer(service, bizB, "DQ-B-vip",     ["vip"],            1500, 4));

  fixture = { service, bizA, bizB, customerIds };
}, 90_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;
  if (fixture.customerIds.length > 0) {
    await svc.from("customers").delete().in("id", fixture.customerIds);
  }
  await svc
    .from("businesses")
    .delete()
    .in("id", [fixture.bizA, fixture.bizB]);
}, 60_000);

describe.runIf(ENABLED)("dashboard-queries — getKpiSnapshot", () => {
  it("returns the expected shape and counts for business A", async () => {
    if (!fixture) throw new Error("fixture missing");
    const result = await getKpiSnapshot(fixture.service, fixture.bizA);

    expect(typeof result.totalCustomers).toBe("number");
    expect(typeof result.newThisMonth).toBe("number");
    expect(typeof result.vipCount).toBe("number");
    expect(typeof result.dormantCount).toBe("number");
    expect(typeof result.atRiskCount).toBe("number");
    expect(typeof result.repeatCount).toBe("number");
    expect(typeof result.totalSpendMyr).toBe("number");
    expect(typeof result.avgAovMyr).toBe("number");

    // Snapshot values for biz A: 3 live customers (vip/repeat, repeat, new).
    expect(result.totalCustomers).toBe(3);
    expect(result.vipCount).toBe(1);
    expect(result.repeatCount).toBe(2);
    // Total spend in biz A = 2500 + 400 + 50 = 2950.
    expect(result.totalSpendMyr).toBeCloseTo(2950, 2);
  });

  it("isolates business B from business A", async () => {
    if (!fixture) throw new Error("fixture missing");
    const result = await getKpiSnapshot(fixture.service, fixture.bizB);
    expect(result.totalCustomers).toBe(1);
    expect(result.vipCount).toBe(1);
    expect(result.repeatCount).toBe(0);
    expect(result.totalSpendMyr).toBeCloseTo(1500, 2);
  });

  it("returns zero defaults for an unknown business id", async () => {
    if (!fixture) throw new Error("fixture missing");
    const result = await getKpiSnapshot(
      fixture.service,
      "00000000-0000-4000-8000-000000000000",
    );
    expect(result.totalCustomers).toBe(0);
    expect(result.totalSpendMyr).toBe(0);
    expect(result.avgAovMyr).toBe(0);
  });
});
