/**
 * Integration tests for POST /api/marketing/customers/[id]/merge.
 *
 *   - Happy path: winner gets loser's tags union'd, loser becomes a
 *     tombstone with `merged_into_id = winner_id`.
 *   - Idempotency: re-merging an already-merged loser returns 409.
 *   - Cross-business: rejecting a winner+loser pair from different
 *     businesses (one customer is in biz B).
 *   - FK re-pointing: seed an external-refs row pointing at a stub test
 *     table, plus a row in that table referencing the loser. After
 *     merge, that row must reference the winner instead.
 *   - `customer.merged` outbox row appears in the same transaction.
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
import { execFileSync } from "node:child_process";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENABLED = Boolean(URL_ && ANON && SERVICE);

interface Fixture {
  bizA: string;
  bizB: string;
  ownerAId: string;
  ownerBId: string;
  service: SupabaseClient;
  cleanupCustomers: string[];
  refRowId: string | null;
  stubTableCreated: boolean;
  stubRowIds: string[];
}

let fixture: Fixture | null = null;

const STUB_TABLE = `marketing_test_orders_${Math.random()
  .toString(36)
  .slice(2, 8)}`;

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

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => {
    if (!fixture) throw new Error("fixture not initialised");
    return fixture.service;
  },
}));

async function seedBusiness(svc: SupabaseClient, label: string): Promise<string> {
  const id = randomUUID();
  const { error } = await svc.from("businesses").insert({
    id,
    idcompany: `m2mg-${label}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    name: `M2 merge ${label}`,
    tier: "micro",
  });
  if (error) throw new Error(`seed biz ${label}: ${error.message}`);
  return id;
}

async function seedUser(
  svc: SupabaseClient,
  bizId: string,
  label: string,
): Promise<string> {
  const email = `${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}@m2mg.bantuniaga.test`;
  const password = `M2M!${Math.random().toString(36).slice(2, 10)}`;
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
    role: "owner",
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

/**
 * Run a raw SQL statement via `psql`. PostgREST doesn't expose raw SQL,
 * but the FK re-pointing test needs to `create table` / `drop table` on
 * a temporary stub. If `psql` isn't on PATH or the env vars aren't set,
 * the helper returns `false` and the dependent test self-skips.
 */
function execSql(sql: string): boolean {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!password || !url) return false;
  const match = url.match(/^https:\/\/([^.]+)\.supabase\.co/);
  if (!match) return false;
  const host = `db.${match[1]}.supabase.co`;
  try {
    execFileSync(
      "psql",
      ["-h", host, "-p", "5432", "-U", "postgres", "-d", "postgres", "-c", sql],
      {
        env: { ...process.env, PGPASSWORD: password },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  if (!ENABLED) return;
  const service = createClient(URL_!, SERVICE!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const bizA = await seedBusiness(service, "a");
  const bizB = await seedBusiness(service, "b");
  const ownerAId = await seedUser(service, bizA, "ownerA");
  const ownerBId = await seedUser(service, bizB, "ownerB");

  // Best-effort: create a stub FK-target table for the re-pointing test.
  // If psql isn't available, that one test self-skips.
  let stubTableCreated = false;
  let refRowId: string | null = null;
  if (
    execSql(
      `create table if not exists public.${STUB_TABLE} (
         id uuid primary key default gen_random_uuid(),
         business_id uuid not null,
         customer_id uuid
       );`,
    )
  ) {
    stubTableCreated = true;
    // PostgREST needs to know the table exists; reload the schema cache.
    execSql("notify pgrst, 'reload schema';");
    const { data: refRow, error: refErr } = await service
      .from("customer_external_refs")
      .insert({
        table_name: STUB_TABLE,
        fk_column: "customer_id",
        pillar: "test",
      })
      .select("id")
      .single();
    if (refErr) {
      stubTableCreated = false;
    } else {
      refRowId = refRow!.id as string;
    }
  }

  fixture = {
    bizA,
    bizB,
    ownerAId,
    ownerBId,
    service,
    cleanupCustomers: [],
    refRowId,
    stubTableCreated,
    stubRowIds: [],
  };
}, 90_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;
  await svc
    .from("events_outbox")
    .delete()
    .in("business_id", [fixture.bizA, fixture.bizB]);
  if (fixture.cleanupCustomers.length > 0) {
    await svc.from("customers").delete().in("id", fixture.cleanupCustomers);
  }
  if (fixture.refRowId) {
    await svc.from("customer_external_refs").delete().eq("id", fixture.refRowId);
  }
  if (fixture.stubTableCreated) {
    execSql(`drop table if exists public.${STUB_TABLE};`);
    execSql("notify pgrst, 'reload schema';");
  }
  await svc.from("users").delete().in("id", [fixture.ownerAId, fixture.ownerBId]);
  await svc.from("businesses").delete().in("id", [fixture.bizA, fixture.bizB]);
  for (const uid of [fixture.ownerAId, fixture.ownerBId]) {
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

function makeReq(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe.runIf(ENABLED)("POST /api/marketing/customers/[id]/merge", () => {
  it("merges loser into winner, unions manual_tags, tombstones loser, emits customer.merged", async () => {
    const winner = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Winner Ali",
      phone_e164: "+60123461001",
      source: "manual",
      manual_tags: ["vip-customer"],
      notes: "Original note",
    });
    const loser = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Loser Ali",
      phone_e164: "+60123461002",
      source: "manual",
      manual_tags: ["online-only"],
      notes: "Extra context",
    });
    fixture!.cleanupCustomers.push(winner, loser);
    await asOwnerA();
    const { POST } = await import(
      "@/app/api/marketing/customers/[id]/merge/route"
    );
    const res = await POST(
      makeReq(
        `http://localhost/api/marketing/customers/${winner}/merge`,
        { winner_id: winner, loser_id: loser },
      ),
      { params: Promise.resolve({ id: winner }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      action: string;
      winner_id: string;
      loser_id: string;
      event_id: string;
    };
    expect(body.action).toBe("merged");
    expect(body.winner_id).toBe(winner);
    expect(body.loser_id).toBe(loser);
    expect(body.event_id).toBeTruthy();

    const { data: winnerRow } = await fixture!.service
      .from("customers")
      .select("manual_tags, notes")
      .eq("id", winner)
      .single();
    expect(winnerRow?.manual_tags).toEqual(
      expect.arrayContaining(["vip-customer", "online-only"]),
    );
    expect(winnerRow?.notes).toContain("Original note");
    expect(winnerRow?.notes).toContain("Extra context");

    const { data: loserRow } = await fixture!.service
      .from("customers")
      .select("merged_into_id, deleted_at")
      .eq("id", loser)
      .single();
    expect(loserRow?.merged_into_id).toBe(winner);
    expect(loserRow?.deleted_at).not.toBeNull();

    const { data: outbox } = await fixture!.service
      .from("events_outbox")
      .select("name, payload")
      .eq("name", "customer.merged")
      .eq("business_id", fixture!.bizA)
      .order("emitted_at", { ascending: false })
      .limit(1);
    expect(outbox && outbox[0]?.payload).toMatchObject({
      surviving_customer_id: winner,
      discarded_customer_id: loser,
      matched_on: "manual_prompt",
    });
  });

  it("re-merging an already-merged loser returns 409", async () => {
    const winner = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Winner 2",
      phone_e164: "+60123461101",
      source: "manual",
    });
    const loser = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Loser 2",
      phone_e164: "+60123461102",
      source: "manual",
    });
    fixture!.cleanupCustomers.push(winner, loser);
    await asOwnerA();
    const { POST } = await import(
      "@/app/api/marketing/customers/[id]/merge/route"
    );
    const first = await POST(
      makeReq(
        `http://localhost/api/marketing/customers/${winner}/merge`,
        { winner_id: winner, loser_id: loser },
      ),
      { params: Promise.resolve({ id: winner }) },
    );
    expect(first.status).toBe(200);

    const winner2 = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Winner 2 again",
      phone_e164: "+60123461103",
      source: "manual",
    });
    fixture!.cleanupCustomers.push(winner2);
    const second = await POST(
      makeReq(
        `http://localhost/api/marketing/customers/${winner2}/merge`,
        { winner_id: winner2, loser_id: loser },
      ),
      { params: Promise.resolve({ id: winner2 }) },
    );
    expect(second.status).toBe(409);
    const body = (await second.json()) as { error: string };
    expect(body.error).toBe("already_merged");
  });

  it("rejects a cross-business merge with 403", async () => {
    const winner = await insertCustomer(fixture!.service, fixture!.bizA, {
      name: "Winner xbiz",
      phone_e164: "+60123461201",
      source: "manual",
    });
    const otherBizLoser = await insertCustomer(fixture!.service, fixture!.bizB, {
      name: "Other Biz Loser",
      phone_e164: "+60123461202",
      source: "manual",
    });
    fixture!.cleanupCustomers.push(winner, otherBizLoser);
    await asOwnerA();
    const { POST } = await import(
      "@/app/api/marketing/customers/[id]/merge/route"
    );
    const res = await POST(
      makeReq(
        `http://localhost/api/marketing/customers/${winner}/merge`,
        { winner_id: winner, loser_id: otherBizLoser },
      ),
      { params: Promise.resolve({ id: winner }) },
    );
    expect(res.status).toBe(403);
  });

  it(
    "re-points FK rows from loser to winner via customer_external_refs",
    async (ctx) => {
      if (!fixture?.stubTableCreated || !fixture?.refRowId) {
        ctx.skip();
        return;
      }
      const winner = await insertCustomer(fixture!.service, fixture!.bizA, {
        name: "FK Winner",
        phone_e164: "+60123461301",
        source: "manual",
      });
      const loser = await insertCustomer(fixture!.service, fixture!.bizA, {
        name: "FK Loser",
        phone_e164: "+60123461302",
        source: "manual",
      });
      fixture!.cleanupCustomers.push(winner, loser);

      // Seed two rows in the stub table that point at the loser.
      const { data: insRows, error } = await fixture!.service
        .from(STUB_TABLE)
        .insert([
          { business_id: fixture!.bizA, customer_id: loser },
          { business_id: fixture!.bizA, customer_id: loser },
        ])
        .select("id");
      if (error) throw error;
      const ids = (insRows ?? []).map((r) => r.id as string);
      fixture!.stubRowIds.push(...ids);

      await asOwnerA();
      const { POST } = await import(
        "@/app/api/marketing/customers/[id]/merge/route"
      );
      const res = await POST(
        makeReq(
          `http://localhost/api/marketing/customers/${winner}/merge`,
          { winner_id: winner, loser_id: loser },
        ),
        { params: Promise.resolve({ id: winner }) },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        repointed: Array<{ table_name: string; fk_column: string; rows: number }>;
      };
      const stubRepoint = body.repointed.find((r) => r.table_name === STUB_TABLE);
      expect(stubRepoint?.rows).toBe(2);

      const { data: post } = await fixture!.service
        .from(STUB_TABLE)
        .select("customer_id")
        .in("id", ids);
      expect(post?.every((r) => r.customer_id === winner)).toBe(true);

      // cleanup
      await fixture!.service.from(STUB_TABLE).delete().in("id", ids);
    },
  );
});

describe.skipIf(ENABLED)("api-merge tests skipped — Supabase env vars missing", () => {
  it("placeholder", () => {
    expect(true).toBe(true);
  });
});
