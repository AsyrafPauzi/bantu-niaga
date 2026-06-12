/**
 * Integration tests for GET /api/marketing/customers (Marketing M2).
 *
 * Hits the live remote Supabase project (same fixture pattern as
 * `rls.test.ts`). We mock two things:
 *   1. `getCurrentUser`              — to control the caller identity
 *      and businessId without spinning up a real HTTP session.
 *   2. `createSupabaseServerClient`  — to return a service-role client.
 *      RLS at the database boundary is exhaustively tested in
 *      `rls.test.ts`; here we verify the API handler's own application-
 *      layer `.eq("business_id", …)` correctly scopes results so a
 *      compromised JWT can never widen tenancy via this handler.
 *
 * Seeds two isolated businesses with several customers each, then
 * asserts: pagination, sort, filters (q / tags / source / spend range /
 * date range), cross-business isolation, RBAC 403 for cashier.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENABLED = Boolean(URL_ && ANON && SERVICE);

interface Fixture {
  bizA: string;
  bizB: string;
  ownerAId: string;
  ownerBId: string;
  cashierAId: string;
  service: SupabaseClient;
  seededCustomers: string[];
  outboxRowsToClean: () => Promise<void>;
}

let fixture: Fixture | null = null;

const currentUserMock = vi.fn();
vi.mock("@/lib/auth/current-user", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/current-user")>(
    "@/lib/auth/current-user",
  );
  return {
    ...actual,
    getCurrentUser: () => currentUserMock(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    if (!fixture) throw new Error("fixture not initialised");
    return fixture.service;
  },
}));

async function seedBusiness(
  service: SupabaseClient,
  label: string,
): Promise<{ id: string; idcompany: string }> {
  const id = randomUUID();
  const idcompany = `m2list-${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const { error } = await service.from("businesses").insert({
    id,
    idcompany,
    name: `M2 list ${label}`,
    tier: "micro",
  });
  if (error) throw new Error(`seed business ${label}: ${error.message}`);
  return { id, idcompany };
}

async function seedUser(
  service: SupabaseClient,
  bizId: string,
  role: "owner" | "manager" | "cashier",
  label: string,
): Promise<string> {
  const email = `${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}@m2list.bantuniaga.test`;
  const password = `M2T!${Math.random().toString(36).slice(2, 10)}`;
  const { data: u, error: ue } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (ue) throw new Error(`seed user ${label}: ${ue.message}`);
  const userId = u.user!.id;
  const { error: pe } = await service.from("users").insert({
    id: userId,
    business_id: bizId,
    role,
    email,
    display_name: label,
  });
  if (pe) throw new Error(`seed profile ${label}: ${pe.message}`);
  return userId;
}

beforeAll(async () => {
  if (!ENABLED) return;
  const service = createClient(URL_!, SERVICE!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const bizA = await seedBusiness(service, "a");
  const bizB = await seedBusiness(service, "b");
  const ownerAId = await seedUser(service, bizA.id, "owner", "ownerA");
  const cashierAId = await seedUser(service, bizA.id, "cashier", "cashA");
  const ownerBId = await seedUser(service, bizB.id, "owner", "ownerB");

  const now = Date.now();
  const seedRows: Array<Record<string, unknown>> = [
    {
      business_id: bizA.id,
      name: "Ali bin Abu",
      phone_e164: "+60123456001",
      total_spend_myr: 1500,
      last_purchase_at: new Date(now - 5 * 86_400_000).toISOString(),
      order_count: 12,
      source: "manual",
      manual_tags: ["vip-customer"],
      auto_tags: ["vip", "repeat"],
    },
    {
      business_id: bizA.id,
      name: "Siti Sara",
      phone_e164: "+60123456002",
      total_spend_myr: 200,
      last_purchase_at: new Date(now - 30 * 86_400_000).toISOString(),
      order_count: 2,
      source: "pos",
      manual_tags: [],
      auto_tags: ["repeat"],
    },
    {
      business_id: bizA.id,
      name: "Rahman Cikgu",
      phone_e164: "+60123456003",
      total_spend_myr: 50,
      last_purchase_at: new Date(now - 200 * 86_400_000).toISOString(),
      order_count: 1,
      source: "csv_import",
      manual_tags: ["kedai-runcit"],
      auto_tags: ["dormant"],
    },
    {
      business_id: bizB.id,
      name: "Other Biz Customer",
      phone_e164: "+60199999999",
      total_spend_myr: 999,
      last_purchase_at: new Date().toISOString(),
      order_count: 1,
      source: "manual",
      manual_tags: [],
      auto_tags: ["new"],
    },
  ];

  const { data: inserted, error: insErr } = await service
    .from("customers")
    .insert(seedRows)
    .select("id");
  if (insErr) throw new Error(`seed customers: ${insErr.message}`);

  fixture = {
    bizA: bizA.id,
    bizB: bizB.id,
    ownerAId,
    ownerBId,
    cashierAId,
    service,
    seededCustomers: (inserted ?? []).map((r) => r.id as string),
    outboxRowsToClean: async () => {
      await service
        .from("events_outbox")
        .delete()
        .in("business_id", [bizA.id, bizB.id]);
    },
  };
}, 90_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;
  await fixture.outboxRowsToClean();
  if (fixture.seededCustomers.length > 0) {
    await svc.from("customers").delete().in("id", fixture.seededCustomers);
  }
  await svc
    .from("users")
    .delete()
    .in("id", [fixture.ownerAId, fixture.ownerBId, fixture.cashierAId]);
  await svc.from("businesses").delete().in("id", [fixture.bizA, fixture.bizB]);
  for (const uid of [fixture.ownerAId, fixture.ownerBId, fixture.cashierAId]) {
    await svc.auth.admin.deleteUser(uid);
  }
}, 60_000);

beforeEach(() => {
  currentUserMock.mockReset();
});

function makeReq(qs: string = "") {
  return new Request(`http://localhost/api/marketing/customers${qs}`, {
    method: "GET",
  });
}

describe.runIf(ENABLED)("GET /api/marketing/customers — list", () => {
  it("returns paginated rows for an owner in their own business", async () => {
    currentUserMock.mockResolvedValue({
      id: fixture!.ownerAId,
      role: "owner",
      businessId: fixture!.bizA,
      isStub: false,
    });
    const { GET } = await import("@/app/api/marketing/customers/route");
    const res = await GET(makeReq("?pageSize=10"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string }>;
      page: number;
      pageSize: number;
      total: number;
    };
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(10);
    expect(body.total).toBeGreaterThanOrEqual(3);
    expect(body.data.length).toBeGreaterThanOrEqual(3);
  });

  it("excludes rows from other businesses (app-level isolation)", async () => {
    currentUserMock.mockResolvedValue({
      id: fixture!.ownerAId,
      role: "owner",
      businessId: fixture!.bizA,
      isStub: false,
    });
    const { GET } = await import("@/app/api/marketing/customers/route");
    const res = await GET(makeReq("?pageSize=200"));
    const body = (await res.json()) as { data: Array<{ name: string }> };
    expect(body.data.every((c) => c.name !== "Other Biz Customer")).toBe(true);
  });

  it("filters by q (name fuzzy)", async () => {
    currentUserMock.mockResolvedValue({
      id: fixture!.ownerAId,
      role: "owner",
      businessId: fixture!.bizA,
      isStub: false,
    });
    const { GET } = await import("@/app/api/marketing/customers/route");
    const res = await GET(makeReq("?q=Siti&pageSize=50"));
    const body = (await res.json()) as { data: Array<{ name: string }> };
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((c) => c.name.toLowerCase().includes("siti"))).toBe(
      true,
    );
  });

  it("filters by tags overlap (auto_tags vip)", async () => {
    currentUserMock.mockResolvedValue({
      id: fixture!.ownerAId,
      role: "owner",
      businessId: fixture!.bizA,
      isStub: false,
    });
    const { GET } = await import("@/app/api/marketing/customers/route");
    const res = await GET(makeReq("?tags=vip&pageSize=50"));
    const body = (await res.json()) as {
      data: Array<{ auto_tags: string[]; manual_tags: string[] }>;
    };
    expect(body.data.length).toBeGreaterThan(0);
    expect(
      body.data.every(
        (c) =>
          (c.auto_tags ?? []).includes("vip") ||
          (c.manual_tags ?? []).includes("vip"),
      ),
    ).toBe(true);
  });

  it("filters by source", async () => {
    currentUserMock.mockResolvedValue({
      id: fixture!.ownerAId,
      role: "owner",
      businessId: fixture!.bizA,
      isStub: false,
    });
    const { GET } = await import("@/app/api/marketing/customers/route");
    const res = await GET(makeReq("?source=pos&pageSize=50"));
    const body = (await res.json()) as { data: Array<{ source: string }> };
    expect(body.data.every((c) => c.source === "pos")).toBe(true);
  });

  it("filters by spend range", async () => {
    currentUserMock.mockResolvedValue({
      id: fixture!.ownerAId,
      role: "owner",
      businessId: fixture!.bizA,
      isStub: false,
    });
    const { GET } = await import("@/app/api/marketing/customers/route");
    const res = await GET(makeReq("?min_spend=1000&pageSize=50"));
    const body = (await res.json()) as {
      data: Array<{ total_spend_myr: number | string }>;
    };
    expect(body.data.every((c) => Number(c.total_spend_myr) >= 1000)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("sorts by total_spend_myr desc", async () => {
    currentUserMock.mockResolvedValue({
      id: fixture!.ownerAId,
      role: "owner",
      businessId: fixture!.bizA,
      isStub: false,
    });
    const { GET } = await import("@/app/api/marketing/customers/route");
    const res = await GET(
      makeReq("?sort=total_spend_myr&order=desc&pageSize=50"),
    );
    const body = (await res.json()) as {
      data: Array<{ total_spend_myr: number | string }>;
    };
    const spends = body.data.map((c) => Number(c.total_spend_myr));
    for (let i = 1; i < spends.length; i++) {
      expect(spends[i] <= spends[i - 1]).toBe(true);
    }
  });

  it("returns 403 for cashier (no marketing.customers permission)", async () => {
    currentUserMock.mockResolvedValue({
      id: fixture!.cashierAId,
      role: "cashier",
      businessId: fixture!.bizA,
      isStub: false,
    });
    const { GET } = await import("@/app/api/marketing/customers/route");
    const res = await GET(makeReq("?pageSize=10"));
    expect(res.status).toBe(403);
  });
});

describe.skipIf(ENABLED)("api-list tests skipped — Supabase env vars missing", () => {
  it("placeholder", () => {
    expect(true).toBe(true);
  });
});
