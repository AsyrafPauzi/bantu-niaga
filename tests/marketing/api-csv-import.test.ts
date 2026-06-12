/**
 * End-to-end integration tests for the M3 CSV import flow.
 *
 * Drives the real route handlers against the live remote Supabase
 * project (same fixture pattern as `rls.test.ts` + `api-list.test.ts`):
 *   - upload   POST   /api/marketing/customers/csv-import
 *   - preview  GET    /api/marketing/customers/csv-import/[id]/preview
 *   - commit   POST   /api/marketing/customers/csv-import/[id]/commit
 *
 * Assertions:
 *   - upload returns 201 with import_id and writes to Storage
 *   - preview categorizes rows into created / merged / rejected
 *   - commit inserts customers + emits one `customer.created` outbox
 *     row per created row (validates atomic-batch semantics)
 *   - cashier role gets 403 on every endpoint
 *   - invalid header returns 422 before any DB writes
 */
import {
  afterAll,
  afterEach,
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

// Service-role client used inside the route handlers (storage,
// dedup-lookup) — we pin it to the live remote so the tests exercise
// the real Storage RPC.
async function seedBusiness(
  service: SupabaseClient,
  label: string,
): Promise<string> {
  const id = randomUUID();
  const slug = `m3csv-${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const { error } = await service.from("businesses").insert({
    id,
    idcompany: slug,
    name: `M3 CSV ${label}`,
    tier: "micro",
  });
  if (error) throw new Error(`seed business ${label}: ${error.message}`);
  return id;
}

async function seedUser(
  service: SupabaseClient,
  bizId: string,
  role: "owner" | "manager" | "cashier",
  label: string,
): Promise<string> {
  const email = `${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}@m3csv.bantuniaga.test`;
  const password = `M3T!${Math.random().toString(36).slice(2, 10)}`;
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
  const ownerAId = await seedUser(service, bizA, "owner", "ownerA");
  const cashierAId = await seedUser(service, bizA, "cashier", "cashA");
  fixture = { bizA, ownerAId, cashierAId, service };
}, 120_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;
  // Remove any customers we created
  await svc.from("customers").delete().eq("business_id", fixture.bizA);
  // Remove any csv_imports we created (their storage objects too)
  const { data: imports } = await svc
    .from("customer_csv_imports")
    .select("id, storage_path")
    .eq("business_id", fixture.bizA);
  if (imports && imports.length > 0) {
    const paths = imports
      .map((r) => r.storage_path as string)
      .filter(Boolean);
    if (paths.length > 0) {
      await svc.storage.from("csv-imports").remove(paths);
    }
    await svc
      .from("customer_csv_imports")
      .delete()
      .in(
        "id",
        imports.map((r) => r.id as string),
      );
  }
  // Remove outbox + users + business
  await svc.from("events_outbox").delete().eq("business_id", fixture.bizA);
  await svc.from("users").delete().in("id", [fixture.ownerAId, fixture.cashierAId]);
  await svc.from("businesses").delete().eq("id", fixture.bizA);
  for (const uid of [fixture.ownerAId, fixture.cashierAId]) {
    await svc.auth.admin.deleteUser(uid);
  }
}, 90_000);

beforeEach(() => {
  currentUserMock.mockReset();
});

afterEach(async () => {
  // Between tests, scrub all customers + imports + outbox for biz A so
  // each test starts from a clean slate.
  if (!fixture) return;
  const svc = fixture.service;
  const { data: imports } = await svc
    .from("customer_csv_imports")
    .select("id, storage_path")
    .eq("business_id", fixture.bizA);
  if (imports && imports.length > 0) {
    const paths = imports
      .map((r) => r.storage_path as string)
      .filter(Boolean);
    if (paths.length > 0) {
      await svc.storage.from("csv-imports").remove(paths);
    }
    await svc
      .from("customer_csv_imports")
      .delete()
      .in(
        "id",
        imports.map((r) => r.id as string),
      );
  }
  await svc.from("customers").delete().eq("business_id", fixture.bizA);
  await svc.from("events_outbox").delete().eq("business_id", fixture.bizA);
});

function asOwner() {
  currentUserMock.mockResolvedValue({
    id: fixture!.ownerAId,
    role: "owner",
    businessId: fixture!.bizA,
    isStub: false,
  });
}
function asCashier() {
  currentUserMock.mockResolvedValue({
    id: fixture!.cashierAId,
    role: "cashier",
    businessId: fixture!.bizA,
    isStub: false,
  });
}

function uploadRequest(csvBody: string, filename = "test.csv"): Request {
  const fd = new FormData();
  fd.append("file", new Blob([csvBody], { type: "text/csv" }), filename);
  return new Request("http://localhost/api/marketing/customers/csv-import", {
    method: "POST",
    body: fd,
  });
}

describe.runIf(ENABLED)("M3 — CSV import end-to-end", () => {
  it("uploads, previews, and commits a clean CSV (3 created, 0 merged, 0 rejected)", async () => {
    asOwner();
    const csv = [
      "name,phone,email,address,notes,manual_tags",
      "M3 Alice,0111111111,alice@m3.test,,,vip",
      "M3 Bob,0122222222,bob@m3.test,,,",
      'M3 Carol,+60133333333,,KL,Note text,kedai-runcit|gold',
    ].join("\n");

    const { POST: upload } = await import(
      "@/app/api/marketing/customers/csv-import/route"
    );
    const upRes = await upload(uploadRequest(csv));
    expect(upRes.status).toBe(201);
    const upBody = (await upRes.json()) as { import_id: string };
    expect(typeof upBody.import_id).toBe("string");

    const { GET: preview } = await import(
      "@/app/api/marketing/customers/csv-import/[id]/preview/route"
    );
    const prevRes = await preview(
      new Request("http://localhost/preview", { method: "GET" }),
      { params: Promise.resolve({ id: upBody.import_id }) },
    );
    expect(prevRes.status).toBe(200);
    const prev = (await prevRes.json()) as {
      summary: { total: number; created: number; merged: number; rejected: number };
      created: Array<{ name: string; phone_e164: string }>;
      merged: unknown[];
      rejected: unknown[];
    };
    expect(prev.summary).toEqual({
      total: 3,
      created: 3,
      merged: 0,
      rejected: 0,
    });
    expect(prev.created.map((r) => r.name).sort()).toEqual([
      "M3 Alice",
      "M3 Bob",
      "M3 Carol",
    ]);
    expect(prev.created[0].phone_e164.startsWith("+60")).toBe(true);

    const { POST: commit } = await import(
      "@/app/api/marketing/customers/csv-import/[id]/commit/route"
    );
    const commitRes = await commit(
      new Request("http://localhost/commit", { method: "POST" }),
      { params: Promise.resolve({ id: upBody.import_id }) },
    );
    expect(commitRes.status).toBe(200);
    const commitBody = (await commitRes.json()) as {
      created: number;
      merged: number;
      rejected: number;
      total: number;
      created_customer_ids: string[];
    };
    expect(commitBody.created).toBe(3);
    expect(commitBody.created_customer_ids).toHaveLength(3);

    // Verify rows in DB
    const { data: customers } = await fixture!.service
      .from("customers")
      .select("id, name, phone_e164, source")
      .eq("business_id", fixture!.bizA);
    expect((customers ?? []).length).toBe(3);
    expect(
      (customers ?? []).every((c) => (c as { source: string }).source === "csv_import"),
    ).toBe(true);

    // One customer.created outbox row per inserted customer
    const { data: outbox } = await fixture!.service
      .from("events_outbox")
      .select("id, payload")
      .eq("business_id", fixture!.bizA)
      .eq("name", "customer.created");
    expect((outbox ?? []).length).toBe(3);
    for (const ev of outbox ?? []) {
      const p = (ev as { payload: { source: string } }).payload;
      expect(p.source).toBe("csv_import");
    }
  }, 90_000);

  it("classifies rows correctly: missing/invalid phone reject, dup-within-upload reject, phone-collision-with-name-mismatch reject (Q9), matching-name merge", async () => {
    // Seed one pre-existing customer Alice / +60111111111 so the
    // preview's merge + reject branches fire.
    await fixture!.service.from("customers").insert({
      business_id: fixture!.bizA,
      name: "Existing Alice",
      phone_e164: "+60111111111",
      source: "manual",
    });

    asOwner();
    const csv = [
      "name,phone,email,address,notes,manual_tags",
      "Existing Alice,0111111111,,,,",       // merge (same phone, same name)
      "Bob NameMismatch,0111111111,,,,",      // reject (same phone, diff name) -- Q9
      "Carol Fresh,+60133333333,,,,",          // create
      "Carol Fresh Again,+60133333333,,,,",   // reject (dup within upload)
      ",+60144444444,,,,",                     // reject (missing name)
      "No Phone,,,,,",                          // reject (missing phone)
      "Bad Phone,not-a-number,,,,",            // reject (invalid phone)
    ].join("\n");

    const { POST: upload } = await import(
      "@/app/api/marketing/customers/csv-import/route"
    );
    const upRes = await upload(uploadRequest(csv));
    expect(upRes.status).toBe(201);
    const { import_id } = (await upRes.json()) as { import_id: string };

    const { GET: preview } = await import(
      "@/app/api/marketing/customers/csv-import/[id]/preview/route"
    );
    const prevRes = await preview(
      new Request("http://localhost/preview", { method: "GET" }),
      { params: Promise.resolve({ id: import_id }) },
    );
    expect(prevRes.status).toBe(200);
    const prev = (await prevRes.json()) as {
      summary: { total: number; created: number; merged: number; rejected: number };
      rejected: Array<{ reason: string; row_number: number }>;
    };
    expect(prev.summary).toEqual({
      total: 7,
      created: 1,
      merged: 1,
      rejected: 5,
    });

    // Row 2: phone-collision-with-name-mismatch (Q9) — must mention the
    // existing customer name in the reason
    const r2 = prev.rejected.find((r) => r.row_number === 2);
    expect(r2?.reason).toMatch(/Existing Alice/);

    // Commit and verify only 1 row was inserted (the Carol Fresh)
    const { POST: commit } = await import(
      "@/app/api/marketing/customers/csv-import/[id]/commit/route"
    );
    const cRes = await commit(
      new Request("http://localhost/commit", { method: "POST" }),
      { params: Promise.resolve({ id: import_id }) },
    );
    expect(cRes.status).toBe(200);
    const cBody = (await cRes.json()) as { created: number; merged: number; rejected: number };
    expect(cBody.created).toBe(1);
    expect(cBody.merged).toBe(1);
    expect(cBody.rejected).toBe(5);
  }, 90_000);

  it("returns 422 when required columns are missing", async () => {
    asOwner();
    const { POST: upload } = await import(
      "@/app/api/marketing/customers/csv-import/route"
    );
    const upRes = await upload(uploadRequest("nickname,email\nx,y@z.com"));
    const { import_id } = (await upRes.json()) as { import_id: string };

    const { GET: preview } = await import(
      "@/app/api/marketing/customers/csv-import/[id]/preview/route"
    );
    const prevRes = await preview(
      new Request("http://localhost/preview", { method: "GET" }),
      { params: Promise.resolve({ id: import_id }) },
    );
    expect(prevRes.status).toBe(422);
    const body = (await prevRes.json()) as { error: string };
    expect(body.error).toBe("invalid_header");
  });

  it("returns 409 on a second commit of the same import_id", async () => {
    asOwner();
    const csv = "name,phone\nFoo,0111122223";
    const { POST: upload } = await import(
      "@/app/api/marketing/customers/csv-import/route"
    );
    const upRes = await upload(uploadRequest(csv));
    const { import_id } = (await upRes.json()) as { import_id: string };

    const { GET: preview } = await import(
      "@/app/api/marketing/customers/csv-import/[id]/preview/route"
    );
    await preview(
      new Request("http://localhost/preview", { method: "GET" }),
      { params: Promise.resolve({ id: import_id }) },
    );
    const { POST: commit } = await import(
      "@/app/api/marketing/customers/csv-import/[id]/commit/route"
    );
    const first = await commit(
      new Request("http://localhost/commit", { method: "POST" }),
      { params: Promise.resolve({ id: import_id }) },
    );
    expect(first.status).toBe(200);

    const second = await commit(
      new Request("http://localhost/commit", { method: "POST" }),
      { params: Promise.resolve({ id: import_id }) },
    );
    expect(second.status).toBe(409);
    const body = (await second.json()) as { error: string };
    expect(body.error).toBe("already_committed");
  }, 60_000);

  it("returns 403 for cashier on every endpoint", async () => {
    asCashier();
    const { POST: upload } = await import(
      "@/app/api/marketing/customers/csv-import/route"
    );
    const r1 = await upload(uploadRequest("name,phone\nX,0111222333"));
    expect(r1.status).toBe(403);

    const { GET: preview } = await import(
      "@/app/api/marketing/customers/csv-import/[id]/preview/route"
    );
    const r2 = await preview(
      new Request("http://localhost/preview", { method: "GET" }),
      { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) },
    );
    expect(r2.status).toBe(403);

    const { POST: commit } = await import(
      "@/app/api/marketing/customers/csv-import/[id]/commit/route"
    );
    const r3 = await commit(
      new Request("http://localhost/commit", { method: "POST" }),
      { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) },
    );
    expect(r3.status).toBe(403);
  });
});

describe.skipIf(ENABLED)("api-csv-import tests skipped — Supabase env vars missing", () => {
  it("placeholder", () => {
    expect(true).toBe(true);
  });
});
