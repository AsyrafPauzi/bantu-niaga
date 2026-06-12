/**
 * Integration tests for GET /api/marketing/customers/search (M2 typeahead).
 *
 *   - matches against name (case-insensitive substring)
 *   - matches against phone prefix
 *   - excludes merged and soft-deleted rows
 *   - 403 for cashier (cashier search lives on Sales POS per Q11)
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
  ownerAId: string;
  cashierAId: string;
  service: SupabaseClient;
  cleanupCustomers: string[];
  visibleId: string;
  deletedId: string;
  mergedId: string;
}

let fixture: Fixture | null = null;

const currentUserMock = vi.fn();
vi.mock("@/lib/auth/current-user", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/current-user")>(
    "@/lib/auth/current-user",
  );
  return { ...actual, getCurrentUser: () => currentUserMock() };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    if (!fixture) throw new Error("fixture not initialised");
    return fixture.service;
  },
}));

beforeAll(async () => {
  if (!ENABLED) return;
  const service = createClient(URL_!, SERVICE!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const bizA = randomUUID();
  const { error: bizErr } = await service.from("businesses").insert({
    id: bizA,
    idcompany: `m2sr-a-${Date.now().toString(36)}`,
    name: "M2 search",
    tier: "micro",
  });
  if (bizErr) throw bizErr;

  async function mkUser(role: "owner" | "cashier", label: string) {
    const email = `${label}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}@m2sr.bantuniaga.test`;
    const password = `M2S!${Math.random().toString(36).slice(2, 10)}`;
    const { data: u, error: ue } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (ue) throw ue;
    const userId = u.user!.id;
    const { error: pe } = await service.from("users").insert({
      id: userId,
      business_id: bizA,
      role,
      email,
      display_name: label,
    });
    if (pe) throw pe;
    return userId;
  }
  const ownerAId = await mkUser("owner", "ownerA");
  const cashierAId = await mkUser("cashier", "cashA");

  const { data: rows, error: cErr } = await service
    .from("customers")
    .insert([
      {
        business_id: bizA,
        name: "Search Match One",
        phone_e164: "+60123470001",
        source: "manual",
      },
      {
        business_id: bizA,
        name: "Should Be Hidden Tombstone",
        phone_e164: "+60123470002",
        source: "manual",
        deleted_at: new Date().toISOString(),
      },
      {
        business_id: bizA,
        name: "Search Match Two",
        phone_e164: "+60123470003",
        source: "manual",
      },
    ])
    .select("id, name");
  if (cErr) throw cErr;
  const idxFor = (n: string) =>
    rows!.findIndex((r) => (r as { name: string }).name === n);
  const visibleId = rows![idxFor("Search Match One")].id as string;
  const deletedId = rows![idxFor("Should Be Hidden Tombstone")].id as string;
  const mergedId = rows![idxFor("Search Match Two")].id as string;

  // Make `mergedId` look like a tombstoned merge.
  await service
    .from("customers")
    .update({
      merged_into_id: visibleId,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", mergedId);

  fixture = {
    bizA,
    ownerAId,
    cashierAId,
    service,
    cleanupCustomers: [visibleId, deletedId, mergedId],
    visibleId,
    deletedId,
    mergedId,
  };
}, 90_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;
  await svc.from("events_outbox").delete().eq("business_id", fixture.bizA);
  await svc.from("customers").delete().in("id", fixture.cleanupCustomers);
  await svc.from("users").delete().in("id", [fixture.ownerAId, fixture.cashierAId]);
  await svc.from("businesses").delete().eq("id", fixture.bizA);
  for (const uid of [fixture.ownerAId, fixture.cashierAId]) {
    await svc.auth.admin.deleteUser(uid);
  }
}, 60_000);

beforeEach(() => {
  currentUserMock.mockReset();
});

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

function makeReq(qs: string) {
  return new Request(
    `http://localhost/api/marketing/customers/search?${qs}`,
    { method: "GET" },
  );
}

describe.runIf(ENABLED)("GET /api/marketing/customers/search", () => {
  it("matches name (case-insensitive substring) and excludes merged + deleted", async () => {
    await asOwnerA();
    const { GET } = await import("@/app/api/marketing/customers/search/route");
    const res = await GET(makeReq("q=search%20match"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; name: string }> };
    const ids = body.data.map((r) => r.id);
    expect(ids).toContain(fixture!.visibleId);
    expect(ids).not.toContain(fixture!.deletedId);
    expect(ids).not.toContain(fixture!.mergedId);
  });

  it("matches phone prefix", async () => {
    await asOwnerA();
    const { GET } = await import("@/app/api/marketing/customers/search/route");
    const res = await GET(makeReq("q=%2B60123470001"));
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.find((r) => r.id === fixture!.visibleId)).toBeTruthy();
  });

  it("returns 403 for cashier", async () => {
    await asCashierA();
    const { GET } = await import("@/app/api/marketing/customers/search/route");
    const res = await GET(makeReq("q=match"));
    expect(res.status).toBe(403);
  });
});

describe.skipIf(ENABLED)("api-search tests skipped — Supabase env vars missing", () => {
  it("placeholder", () => {
    expect(true).toBe(true);
  });
});
