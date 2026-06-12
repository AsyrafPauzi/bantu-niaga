/**
 * Integration tests for /api/marketing/customers/[id] (Marketing M2).
 *
 *   - GET:    returns customer + tag_history; soft-deleted is 404
 *   - PATCH:  desktop full-field; mobile restricted to notes/manual_tags/
 *             phone (rejects unknown fields when mode=mobile); emits
 *             `customer.updated` outbox row with correct `changed_fields`;
 *             phone collision returns `action: "prompt"`.
 *   - DELETE: sets `deleted_at` and emits `customer.deleted` outbox row.
 *   - RBAC:   cashier is 403 on every verb.
 *   - RLS:    cross-business GET is 404.
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
  cleanupCustomers: string[];
  cleanupOutboxBizIds: string[];
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

async function seedBusiness(svc: SupabaseClient, label: string): Promise<string> {
  const id = randomUUID();
  const { error } = await svc.from("businesses").insert({
    id,
    idcompany: `m2det-${label}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    name: `M2 detail ${label}`,
    tier: "micro",
  });
  if (error) throw new Error(`seed biz ${label}: ${error.message}`);
  return id;
}

async function seedUser(
  svc: SupabaseClient,
  bizId: string,
  role: "owner" | "cashier",
  label: string,
): Promise<string> {
  const email = `${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}@m2det.bantuniaga.test`;
  const password = `M2D!${Math.random().toString(36).slice(2, 10)}`;
  const { data: u, error: ue } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (ue) throw new Error(`seed user ${label}: ${ue.message}`);
  const userId = u.user!.id;
  const { error: pe } = await svc.from("users").insert({
    id: userId,
    business_id: bizId,
    role,
    email,
    display_name: label,
  });
  if (pe) throw new Error(`seed profile ${label}: ${pe.message}`);
  return userId;
}

async function insertCustomer(
  svc: SupabaseClient,
  bizId: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await svc
    .from("customers")
    .insert({ business_id: bizId, ...fields })
    .select("id")
    .single();
  if (error) throw new Error(`insert customer: ${error.message}`);
  return data!.id as string;
}

beforeAll(async () => {
  if (!ENABLED) return;
  const service = createClient(URL_!, SERVICE!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const bizA = await seedBusiness(service, "a");
  const bizB = await seedBusiness(service, "b");
  const ownerAId = await seedUser(service, bizA, "owner", "ownerA");
  const cashierAId = await seedUser(service, bizA, "cashier", "cashA");
  const ownerBId = await seedUser(service, bizB, "owner", "ownerB");

  fixture = {
    bizA,
    bizB,
    ownerAId,
    ownerBId,
    cashierAId,
    service,
    cleanupCustomers: [],
    cleanupOutboxBizIds: [bizA, bizB],
  };
}, 90_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;
  await svc
    .from("events_outbox")
    .delete()
    .in("business_id", fixture.cleanupOutboxBizIds);
  if (fixture.cleanupCustomers.length > 0) {
    await svc.from("customers").delete().in("id", fixture.cleanupCustomers);
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

function makeReq(
  url: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> },
) {
  return new Request(url, {
    method: init?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: init?.body != null ? JSON.stringify(init.body) : undefined,
  });
}

async function asOwnerA() {
  currentUserMock.mockResolvedValue({
    id: fixture!.ownerAId,
    role: "owner",
    businessId: fixture!.bizA,
    isStub: false,
  });
}

async function asCashierA() {
  currentUserMock.mockResolvedValue({
    id: fixture!.cashierAId,
    role: "cashier",
    businessId: fixture!.bizA,
    isStub: false,
  });
}

async function asOwnerB() {
  currentUserMock.mockResolvedValue({
    id: fixture!.ownerBId,
    role: "owner",
    businessId: fixture!.bizB,
    isStub: false,
  });
}

describe.runIf(ENABLED)("GET/PATCH/DELETE /api/marketing/customers/[id]", () => {
  it("GET returns the customer + (empty) tag history", async () => {
    const id = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Detail Test 1",
      phone_e164: "+60123450001",
      source: "manual",
    });
    fixture!.cleanupCustomers.push(id);
    await asOwnerA();
    const { GET } = await import("@/app/api/marketing/customers/[id]/route");
    const res = await GET(
      makeReq(`http://localhost/api/marketing/customers/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      customer: { id: string; name: string };
      tag_history: unknown[];
    };
    expect(body.customer.id).toBe(id);
    expect(body.customer.name).toBe("Detail Test 1");
    expect(Array.isArray(body.tag_history)).toBe(true);
  });

  it("GET cross-business returns 404 (RLS-equivalent app-layer guard)", async () => {
    const id = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Detail Test xbiz",
      phone_e164: "+60123450101",
      source: "manual",
    });
    fixture!.cleanupCustomers.push(id);
    await asOwnerB();
    const { GET } = await import("@/app/api/marketing/customers/[id]/route");
    const res = await GET(
      makeReq(`http://localhost/api/marketing/customers/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(404);
  });

  it("PATCH desktop full mode updates name + emits customer.updated", async () => {
    const id = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Patch Desktop",
      phone_e164: "+60123450002",
      source: "manual",
    });
    fixture!.cleanupCustomers.push(id);
    await asOwnerA();
    const { PATCH } = await import("@/app/api/marketing/customers/[id]/route");
    const res = await PATCH(
      makeReq(`http://localhost/api/marketing/customers/${id}`, {
        method: "PATCH",
        headers: { "X-Surface-Mode": "desktop" },
        body: { name: "Patch Desktop Renamed" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      action: string;
      changed_fields: string[];
    };
    expect(body.action).toBe("updated");
    expect(body.changed_fields).toContain("name");

    const { data: outbox } = await fixture!.service
      .from("events_outbox")
      .select("id, name, payload")
      .eq("name", "customer.updated")
      .eq("business_id", fixture!.bizA)
      .order("emitted_at", { ascending: false })
      .limit(1);
    expect(outbox && outbox[0]?.payload).toMatchObject({
      customer_id: id,
      changed_fields: ["name"],
    });
  });

  it("PATCH mobile mode rejects name/email/address as unknown keys", async () => {
    const id = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Patch Mobile",
      phone_e164: "+60123450003",
      source: "manual",
    });
    fixture!.cleanupCustomers.push(id);
    await asOwnerA();
    const { PATCH } = await import("@/app/api/marketing/customers/[id]/route");
    const res = await PATCH(
      makeReq(`http://localhost/api/marketing/customers/${id}`, {
        method: "PATCH",
        headers: { "X-Surface-Mode": "mobile" },
        body: { name: "Should Reject" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("validation_failed");
  });

  it("PATCH mobile mode accepts notes / manual_tags / phone", async () => {
    const id = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Mobile Three",
      phone_e164: "+60123450004",
      source: "manual",
    });
    fixture!.cleanupCustomers.push(id);
    await asOwnerA();
    const { PATCH } = await import("@/app/api/marketing/customers/[id]/route");
    const res = await PATCH(
      makeReq(`http://localhost/api/marketing/customers/${id}`, {
        method: "PATCH",
        headers: { "X-Surface-Mode": "mobile" },
        body: {
          notes: "Called Friday",
          manual_tags: ["online-only"],
          phone: "+60123450009",
        },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { changed_fields: string[] };
    expect(body.changed_fields.sort()).toEqual(
      ["manual_tags", "notes", "phone_e164"].sort(),
    );
  });

  it("PATCH with phone collision returns action: prompt", async () => {
    const a = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Collision A",
      phone_e164: "+60123450005",
      source: "manual",
    });
    const b = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Collision B",
      phone_e164: "+60123450006",
      source: "manual",
    });
    fixture!.cleanupCustomers.push(a, b);
    await asOwnerA();
    const { PATCH } = await import("@/app/api/marketing/customers/[id]/route");
    const res = await PATCH(
      makeReq(`http://localhost/api/marketing/customers/${b}`, {
        method: "PATCH",
        headers: { "X-Surface-Mode": "desktop" },
        body: { phone: "+60123450005" },
      }),
      { params: Promise.resolve({ id: b }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      action: string;
      existing_customer_id: string;
    };
    expect(body.action).toBe("prompt");
    expect(body.existing_customer_id).toBe(a);
  });

  it("DELETE soft-deletes and emits customer.deleted", async () => {
    const id = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Soft Delete Me",
      phone_e164: "+60123450007",
      source: "manual",
    });
    fixture!.cleanupCustomers.push(id);
    await asOwnerA();
    const { DELETE } = await import("@/app/api/marketing/customers/[id]/route");
    const res = await DELETE(
      makeReq(`http://localhost/api/marketing/customers/${id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      action: string;
      deleted_at: string | null;
    };
    expect(body.action).toBe("deleted");
    expect(body.deleted_at).not.toBeNull();

    const { data: row } = await fixture!.service
      .from("customers")
      .select("deleted_at")
      .eq("id", id)
      .single();
    expect(row?.deleted_at).not.toBeNull();

    const { data: outbox } = await fixture!.service
      .from("events_outbox")
      .select("name, payload")
      .eq("name", "customer.deleted")
      .eq("business_id", fixture!.bizA)
      .order("emitted_at", { ascending: false })
      .limit(1);
    expect(outbox && outbox[0]?.payload).toMatchObject({ customer_id: id });
  });

  it("DELETE on already-deleted customer returns 404", async () => {
    const id = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Ghost",
      phone_e164: "+60123450008",
      source: "manual",
      deleted_at: new Date().toISOString(),
    });
    fixture!.cleanupCustomers.push(id);
    await asOwnerA();
    const { DELETE } = await import("@/app/api/marketing/customers/[id]/route");
    const res = await DELETE(
      makeReq(`http://localhost/api/marketing/customers/${id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(404);
  });

  it("cashier is 403 on GET / PATCH / DELETE", async () => {
    const id = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Cashier 403",
      phone_e164: "+60123450010",
      source: "manual",
    });
    fixture!.cleanupCustomers.push(id);
    await asCashierA();
    const route = await import("@/app/api/marketing/customers/[id]/route");
    const getRes = await route.GET(
      makeReq(`http://localhost/api/marketing/customers/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(getRes.status).toBe(403);
    const patchRes = await route.PATCH(
      makeReq(`http://localhost/api/marketing/customers/${id}`, {
        method: "PATCH",
        body: { notes: "x" },
        headers: { "X-Surface-Mode": "mobile" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(patchRes.status).toBe(403);
    const delRes = await route.DELETE(
      makeReq(`http://localhost/api/marketing/customers/${id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(delRes.status).toBe(403);
  });
});

describe.skipIf(ENABLED)("api-detail tests skipped — Supabase env vars missing", () => {
  it("placeholder", () => {
    expect(true).toBe(true);
  });
});
