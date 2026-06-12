/**
 * Integration tests for /api/marketing/content (Marketing M5).
 *
 *   - POST   /api/marketing/content
 *   - GET    /api/marketing/content (month + status filters)
 *   - GET    /api/marketing/content/[id]
 *   - PATCH  /api/marketing/content/[id]   (validate status transitions)
 *   - DELETE /api/marketing/content/[id]   (hard delete)
 *   - POST   /api/marketing/content/[id]/media
 *
 * Same fixture pattern as `api-list.test.ts` / `api-detail.test.ts`:
 * we mock `getCurrentUser` + the SSR Supabase client (service-role
 * binding scoped to the test fixture), and seed two isolated
 * businesses to assert cross-tenant isolation.
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
  createdEntries: string[];
}

let fixture: Fixture | null = null;

const currentUserMock = vi.fn();
vi.mock("@/lib/auth/current-user", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/auth/current-user")
  >("@/lib/auth/current-user");
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
    idcompany: `m5-${label}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    name: `M5 content ${label}`,
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
    .slice(2, 6)}@m5.bantuniaga.test`;
  const password = `M5T!${Math.random().toString(36).slice(2, 10)}`;
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

async function insertEntry(
  svc: SupabaseClient,
  bizId: string,
  row: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await svc
    .from("content_plan")
    .insert({ business_id: bizId, channel: "tiktok", status: "idea", ...row })
    .select("id")
    .single();
  if (error) throw new Error(`insert content_plan: ${error.message}`);
  const id = (data as { id: string }).id;
  if (fixture) fixture.createdEntries.push(id);
  return id;
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
    createdEntries: [],
  };
}, 90_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;
  if (fixture.createdEntries.length > 0) {
    await svc.from("content_plan").delete().in("id", fixture.createdEntries);
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

function asOwnerA() {
  currentUserMock.mockResolvedValue({
    id: fixture!.ownerAId,
    role: "owner",
    businessId: fixture!.bizA,
    isStub: false,
  });
}

function asCashierA() {
  currentUserMock.mockResolvedValue({
    id: fixture!.cashierAId,
    role: "cashier",
    businessId: fixture!.bizA,
    isStub: false,
  });
}

function asOwnerB() {
  currentUserMock.mockResolvedValue({
    id: fixture!.ownerBId,
    role: "owner",
    businessId: fixture!.bizB,
    isStub: false,
  });
}

describe.runIf(ENABLED)("POST /api/marketing/content — create", () => {
  it("returns 201 + created entry for owner", async () => {
    asOwnerA();
    const { POST } = await import("@/app/api/marketing/content/route");
    const res = await POST(
      makeReq("http://localhost/api/marketing/content", {
        method: "POST",
        body: {
          channel: "tiktok",
          status: "idea",
          hook: "Raya promo BOGO",
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      action: string;
      entry: { id: string; channel: string };
    };
    expect(body.action).toBe("created");
    expect(body.entry.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.entry.channel).toBe("tiktok");
    fixture!.createdEntries.push(body.entry.id);
  });

  it("attaches media file_ids from the create payload", async () => {
    asOwnerA();
    const { POST } = await import("@/app/api/marketing/content/route");
    const fileId = randomUUID();
    const res = await POST(
      makeReq("http://localhost/api/marketing/content", {
        method: "POST",
        body: {
          channel: "instagram",
          hook: "carousel idea",
          media_file_ids: [fileId],
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { entry: { id: string } };
    fixture!.createdEntries.push(body.entry.id);

    const { data: rows } = await fixture!.service
      .from("content_plan_media")
      .select("file_id")
      .eq("business_id", fixture!.bizA)
      .eq("content_plan_id", body.entry.id);
    expect(rows?.map((r) => r.file_id)).toEqual([fileId]);
  });

  it("returns 403 for cashier (no marketing.content)", async () => {
    asCashierA();
    const { POST } = await import("@/app/api/marketing/content/route");
    const res = await POST(
      makeReq("http://localhost/api/marketing/content", {
        method: "POST",
        body: { channel: "tiktok" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 on bad channel", async () => {
    asOwnerA();
    const { POST } = await import("@/app/api/marketing/content/route");
    const res = await POST(
      makeReq("http://localhost/api/marketing/content", {
        method: "POST",
        body: { channel: "twitter" },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe.runIf(ENABLED)("GET /api/marketing/content — month + filter", () => {
  it("returns only this-month entries when year/month given", async () => {
    asOwnerA();
    // Seed: one scheduled in the target month (next month so the test is
    // stable across calendar boundaries), one in the month after.
    const now = new Date();
    const nextMonthIdx = now.getUTCMonth() + 1;
    const nextMonthYear =
      nextMonthIdx === 12 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
    const nextMonthMonth = nextMonthIdx === 12 ? 1 : nextMonthIdx + 1;

    const inMonth = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "tiktok",
      status: "scheduled",
      // 10th of next month at 09:00 MYT → 01:00 UTC
      scheduled_at: new Date(
        Date.UTC(nextMonthYear, nextMonthMonth - 1, 10, 1, 0, 0),
      ).toISOString(),
      hook: "in-month entry",
    });
    const next = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "tiktok",
      status: "scheduled",
      // 5th of month AFTER target → out of range.
      scheduled_at: new Date(
        Date.UTC(
          nextMonthMonth === 12 ? nextMonthYear + 1 : nextMonthYear,
          nextMonthMonth === 12 ? 0 : nextMonthMonth,
          5,
          1,
          0,
          0,
        ),
      ).toISOString(),
      hook: "out-of-month entry",
    });

    const { GET } = await import("@/app/api/marketing/content/route");
    const res = await GET(
      makeReq(
        `http://localhost/api/marketing/content?year=${nextMonthYear}&month=${nextMonthMonth}`,
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string; hook: string | null }>;
    };
    const ids = body.data.map((r) => r.id);
    expect(ids).toContain(inMonth);
    expect(ids).not.toContain(next);
  });

  it("filters by status", async () => {
    asOwnerA();
    const idea = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "facebook",
      status: "idea",
      hook: "filter idea",
    });
    const drafted = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "facebook",
      status: "drafted",
      hook: "filter drafted",
    });
    const { GET } = await import("@/app/api/marketing/content/route");
    const res = await GET(
      makeReq("http://localhost/api/marketing/content?status=drafted"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string; status: string }>;
    };
    const ids = body.data.map((r) => r.id);
    expect(ids).toContain(drafted);
    expect(ids).not.toContain(idea);
  });

  it("isolates entries across businesses", async () => {
    asOwnerB();
    // Seed an entry in biz A so the B-owner SHOULD NOT see it.
    asOwnerA();
    const idA = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "tiktok",
      hook: "biz-A only",
    });
    // Now query as owner B.
    asOwnerB();
    const { GET } = await import("@/app/api/marketing/content/route");
    const res = await GET(makeReq("http://localhost/api/marketing/content"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((r) => r.id)).not.toContain(idA);
  });

  it("returns 400 when year given without month", async () => {
    asOwnerA();
    const { GET } = await import("@/app/api/marketing/content/route");
    const res = await GET(
      makeReq("http://localhost/api/marketing/content?year=2026"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 for cashier", async () => {
    asCashierA();
    const { GET } = await import("@/app/api/marketing/content/route");
    const res = await GET(makeReq("http://localhost/api/marketing/content"));
    expect(res.status).toBe(403);
  });
});

describe.runIf(ENABLED)("/api/marketing/content/[id] — detail / PATCH / DELETE", () => {
  it("GET cross-business returns 404", async () => {
    asOwnerA();
    const id = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "instagram",
      hook: "x-biz",
    });
    asOwnerB();
    const { GET } = await import("@/app/api/marketing/content/[id]/route");
    const res = await GET(
      makeReq(`http://localhost/api/marketing/content/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(404);
  });

  it("PATCH idea → drafted → scheduled → posted (linear path)", async () => {
    asOwnerA();
    const id = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "tiktok",
      status: "idea",
    });
    const { PATCH } = await import("@/app/api/marketing/content/[id]/route");

    for (const step of ["drafted", "scheduled", "posted"] as const) {
      const res = await PATCH(
        makeReq(`http://localhost/api/marketing/content/${id}`, {
          method: "PATCH",
          body: { status: step },
        }),
        { params: Promise.resolve({ id }) },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        action: string;
        entry: { status: string; posted_at: string | null };
      };
      expect(body.action).toBe("updated");
      expect(body.entry.status).toBe(step);
      if (step === "posted") {
        expect(body.entry.posted_at).not.toBeNull();
      }
    }
  });

  it("PATCH posted → drafted is rejected (terminal in v1)", async () => {
    asOwnerA();
    const id = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "tiktok",
      status: "posted",
      posted_at: new Date().toISOString(),
    });
    const { PATCH } = await import("@/app/api/marketing/content/[id]/route");
    const res = await PATCH(
      makeReq(`http://localhost/api/marketing/content/${id}`, {
        method: "PATCH",
        body: { status: "drafted" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_status_transition");
  });

  it("PATCH scheduled → idea (backwards) is allowed", async () => {
    asOwnerA();
    const id = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "tiktok",
      status: "scheduled",
    });
    const { PATCH } = await import("@/app/api/marketing/content/[id]/route");
    const res = await PATCH(
      makeReq(`http://localhost/api/marketing/content/${id}`, {
        method: "PATCH",
        body: { status: "idea" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entry: { status: string } };
    expect(body.entry.status).toBe("idea");
  });

  it("DELETE removes the row (and cascades media)", async () => {
    asOwnerA();
    const id = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "facebook",
      status: "idea",
    });
    const fileId = randomUUID();
    await fixture!.service.from("content_plan_media").insert({
      content_plan_id: id,
      file_id: fileId,
      business_id: fixture!.bizA,
      position: 0,
    });
    const { DELETE } = await import("@/app/api/marketing/content/[id]/route");
    const res = await DELETE(
      makeReq(`http://localhost/api/marketing/content/${id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    // Subsequent GET → 404.
    const { GET } = await import("@/app/api/marketing/content/[id]/route");
    const res2 = await GET(
      makeReq(`http://localhost/api/marketing/content/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(res2.status).toBe(404);
    // Junction rows are gone too.
    const { data: media } = await fixture!.service
      .from("content_plan_media")
      .select("file_id")
      .eq("content_plan_id", id);
    expect(media ?? []).toEqual([]);
    // No need to push id into cleanup — already deleted.
  });

  it("DELETE 404 for cross-business", async () => {
    asOwnerA();
    const id = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "tiktok",
    });
    asOwnerB();
    const { DELETE } = await import("@/app/api/marketing/content/[id]/route");
    const res = await DELETE(
      makeReq(`http://localhost/api/marketing/content/${id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(404);
  });

  it("cashier gets 403 on every verb", async () => {
    asOwnerA();
    const id = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "tiktok",
    });
    asCashierA();
    const detailMod = await import("@/app/api/marketing/content/[id]/route");
    const getRes = await detailMod.GET(
      makeReq(`http://localhost/api/marketing/content/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(getRes.status).toBe(403);
    const patchRes = await detailMod.PATCH(
      makeReq(`http://localhost/api/marketing/content/${id}`, {
        method: "PATCH",
        body: { status: "drafted" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(patchRes.status).toBe(403);
    const delRes = await detailMod.DELETE(
      makeReq(`http://localhost/api/marketing/content/${id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(delRes.status).toBe(403);
  });
});

describe.runIf(ENABLED)("/api/marketing/content/[id]/media — attach", () => {
  it("POST upserts a media row", async () => {
    asOwnerA();
    const id = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "tiktok",
    });
    const fileId = randomUUID();
    const { POST } = await import(
      "@/app/api/marketing/content/[id]/media/route"
    );
    const res = await POST(
      makeReq(`http://localhost/api/marketing/content/${id}/media`, {
        method: "POST",
        body: { file_id: fileId, position: 0 },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      media: { file_id: string };
    };
    expect(body.media.file_id).toBe(fileId);
  });

  it("POST is idempotent on (entry, file_id)", async () => {
    asOwnerA();
    const id = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "tiktok",
    });
    const fileId = randomUUID();
    const { POST } = await import(
      "@/app/api/marketing/content/[id]/media/route"
    );
    const first = await POST(
      makeReq(`http://localhost/api/marketing/content/${id}/media`, {
        method: "POST",
        body: { file_id: fileId, position: 0 },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(first.status).toBe(201);
    const second = await POST(
      makeReq(`http://localhost/api/marketing/content/${id}/media`, {
        method: "POST",
        body: { file_id: fileId, position: 5 },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(second.status).toBe(201);
    const { count } = await fixture!.service
      .from("content_plan_media")
      .select("file_id", { count: "exact", head: true })
      .eq("content_plan_id", id)
      .eq("file_id", fileId);
    expect(count).toBe(1);
  });

  it("POST media on a foreign-business entry returns 404", async () => {
    asOwnerA();
    const id = await insertEntry(fixture!.service, fixture!.bizA, {
      channel: "tiktok",
    });
    asOwnerB();
    const { POST } = await import(
      "@/app/api/marketing/content/[id]/media/route"
    );
    const res = await POST(
      makeReq(`http://localhost/api/marketing/content/${id}/media`, {
        method: "POST",
        body: { file_id: randomUUID() },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(404);
  });
});

describe.skipIf(ENABLED)(
  "api-content tests skipped — Supabase env vars missing",
  () => {
    it("placeholder", () => {
      expect(true).toBe(true);
    });
  },
);
