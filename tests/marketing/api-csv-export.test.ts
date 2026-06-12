/**
 * Integration tests for GET /api/marketing/customers/csv-export and the
 * import→export→reimport round-trip.
 *
 * The round-trip is the key assertion for M3: exporting the customer
 * book and re-uploading the resulting CSV should preview every row as
 * "merged" (same phone + same name), with zero creations.
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
  seededCustomerIds: string[];
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

async function seedBusiness(service: SupabaseClient, label: string): Promise<string> {
  const id = randomUUID();
  const slug = `m3exp-${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const { error } = await service.from("businesses").insert({
    id,
    idcompany: slug,
    name: `M3 export ${label}`,
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
    .slice(2, 6)}@m3exp.bantuniaga.test`;
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

  // Seed 5 live customers — these are the rows that will be exported.
  // PostgREST normalizes mixed-shape bulk inserts to the union of keys
  // and sends `null` for missing values, which would trip the
  // not-null default on `manual_tags`. Spell every field on every row.
  const rows = [
    {
      name: "Exp Alice",
      phone_e164: "+60111111101",
      email: "alice@exp.test",
      address: null,
      notes: null,
      manual_tags: [],
    },
    {
      name: "Exp Bob",
      phone_e164: "+60111111102",
      email: "bob@exp.test",
      address: "KL",
      notes: null,
      manual_tags: [],
    },
    {
      name: "Exp Carol",
      phone_e164: "+60111111103",
      email: null,
      address: null,
      notes: "Notes with, comma",
      manual_tags: [],
    },
    {
      name: "Exp Dani",
      phone_e164: "+60111111104",
      email: null,
      address: null,
      notes: null,
      manual_tags: ["vip", "gold"],
    },
    {
      name: "Exp Eli",
      phone_e164: "+60111111105",
      email: null,
      address: null,
      notes: null,
      manual_tags: [],
    },
  ];
  const { data: inserted, error } = await service
    .from("customers")
    .insert(
      rows.map((r) => ({
        ...r,
        business_id: bizA,
        source: "manual",
      })),
    )
    .select("id");
  if (error) throw new Error(`seed customers: ${error.message}`);
  const seededCustomerIds = (inserted ?? []).map((r) => r.id as string);
  fixture = { bizA, ownerAId, cashierAId, service, seededCustomerIds };
}, 120_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;
  // Pull any csv_imports for cleanup
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
  await svc.from("users").delete().in("id", [fixture.ownerAId, fixture.cashierAId]);
  await svc.from("businesses").delete().eq("id", fixture.bizA);
  for (const uid of [fixture.ownerAId, fixture.cashierAId]) {
    await svc.auth.admin.deleteUser(uid);
  }
}, 90_000);

beforeEach(() => {
  currentUserMock.mockReset();
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

describe.runIf(ENABLED)("GET /api/marketing/customers/csv-export", () => {
  it("streams a CSV with the expected header and one row per live customer", async () => {
    asOwner();
    const { GET } = await import(
      "@/app/api/marketing/customers/csv-export/route"
    );
    const res = await GET(
      new Request("http://localhost/api/marketing/customers/csv-export"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/csv/);
    expect(res.headers.get("Content-Disposition")).toMatch(/filename=/);
    expect(res.headers.get("Content-Disposition")).toMatch(/bantuniaga-customers/);
    const body = await res.text();
    const lines = body.split("\n").filter((l) => l.length > 0);
    expect(lines[0]).toMatch(/^name,phone,email,address,notes,manual_tags,auto_tags/);
    // 5 seeded rows
    expect(lines.length).toBeGreaterThanOrEqual(1 + 5);
  });

  it("returns 403 for cashier", async () => {
    asCashier();
    const { GET } = await import(
      "@/app/api/marketing/customers/csv-export/route"
    );
    const res = await GET(
      new Request("http://localhost/api/marketing/customers/csv-export"),
    );
    expect(res.status).toBe(403);
  });
});

describe.runIf(ENABLED)("Round-trip: export → re-import → all merged", () => {
  it("treats every exported row as a merge on re-import (zero new customers)", async () => {
    asOwner();
    const { GET: exportRoute } = await import(
      "@/app/api/marketing/customers/csv-export/route"
    );
    const exp = await exportRoute(
      new Request("http://localhost/api/marketing/customers/csv-export"),
    );
    expect(exp.status).toBe(200);
    const csv = await exp.text();

    const { POST: upload } = await import(
      "@/app/api/marketing/customers/csv-import/route"
    );
    const fd = new FormData();
    fd.append(
      "file",
      new Blob([csv], { type: "text/csv" }),
      "roundtrip.csv",
    );
    const upRes = await upload(
      new Request("http://localhost/api/marketing/customers/csv-import", {
        method: "POST",
        body: fd,
      }),
    );
    expect(upRes.status).toBe(201);
    const upBody = (await upRes.json()) as { import_id: string };

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
    };
    // Every seeded row should match by phone + same name → merged
    expect(prev.summary.created).toBe(0);
    expect(prev.summary.merged).toBe(5);
    expect(prev.summary.rejected).toBe(0);
  }, 120_000);
});

describe.skipIf(ENABLED)("api-csv-export tests skipped — Supabase env vars missing", () => {
  it("placeholder", () => {
    expect(true).toBe(true);
  });
});
