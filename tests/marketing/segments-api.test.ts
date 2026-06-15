/**
 * Integration tests for /api/marketing/segments routes.
 *
 * Strategy: mock `getCurrentUser` + `createSupabaseServerClient` at the
 * module boundary and route the supabase-js builder calls through a
 * recording stub. We exercise the real handler logic — schema
 * validation, RBAC, RLS scoping calls — without a live DB.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/current-user";

const OWNER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000aa",
  role: "owner",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

const ACCOUNTANT: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000cc",
  role: "accountant",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

const SEGMENT_ID = "20000000-0000-4000-8000-000000000001";
const AUTO_SEGMENT_ID = "20000000-0000-4000-8000-000000000002";

interface QueryStub {
  table: string;
  ops: { method: string; args: unknown[] }[];
  /**
   * Resolves the query. Tests configure this per-route. The default
   * resolves to `{ data: null, error: null }`.
   */
  resolve?: () => Promise<unknown>;
}

interface SupabaseStub {
  queries: QueryStub[];
  from: (table: string) => Promise<unknown> & Record<string, unknown>;
}

function makeSupabaseStub(
  handlers: Record<string, (q: QueryStub) => Promise<unknown>>,
): SupabaseStub {
  const queries: QueryStub[] = [];

  function from(table: string) {
    const q: QueryStub = { table, ops: [] };
    queries.push(q);

    function method(name: string) {
      return (...args: unknown[]) => {
        q.ops.push({ method: name, args });
        return chain;
      };
    }
    function thenLike(onResolve: (value: unknown) => unknown) {
      const handler = handlers[`${table}:${q.ops.map((o) => o.method).join(",")}`]
        ?? handlers[table]
        ?? (async () => ({ data: null, error: null }));
      return handler(q).then(onResolve);
    }
    const chain: Record<string, unknown> = {
      select: method("select"),
      insert: method("insert"),
      update: method("update"),
      upsert: method("upsert"),
      delete: method("delete"),
      eq: method("eq"),
      neq: method("neq"),
      is: method("is"),
      in: method("in"),
      gte: method("gte"),
      lte: method("lte"),
      gt: method("gt"),
      lt: method("lt"),
      or: method("or"),
      overlaps: method("overlaps"),
      order: method("order"),
      limit: method("limit"),
      range: method("range"),
      maybeSingle: method("maybeSingle"),
      single: method("single"),
      then: thenLike,
    };
    return chain;
  }

  return { queries, from: from as SupabaseStub["from"] };
}

async function loadRoutes(opts: {
  user?: CurrentUser | "unauthorized";
  supabaseHandlers?: Record<string, (q: QueryStub) => Promise<unknown>>;
}) {
  vi.resetModules();
  const { UnauthorizedError } = await import("@/lib/auth/current-user");

  vi.doMock("@/lib/auth/current-user", async () => {
    const actual = await vi.importActual<typeof import("@/lib/auth/current-user")>(
      "@/lib/auth/current-user",
    );
    return {
      ...actual,
      getCurrentUser: vi.fn(async () => {
        if (opts.user === "unauthorized") {
          throw new UnauthorizedError("no_session", "test: no session");
        }
        return opts.user ?? OWNER;
      }),
    };
  });

  const supabase = makeSupabaseStub(opts.supabaseHandlers ?? {});
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => supabase),
  }));

  const list = await import("@/app/api/marketing/segments/route");
  const detail = await import("@/app/api/marketing/segments/[id]/route");
  const members = await import(
    "@/app/api/marketing/segments/[id]/members/route"
  );
  const preview = await import(
    "@/app/api/marketing/segments/preview-count/route"
  );

  return {
    list,
    detail,
    members,
    preview,
    supabase,
  };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/auth/current-user");
  vi.doUnmock("@/lib/supabase/server");
});

describe("GET /api/marketing/segments", () => {
  beforeEach(() => vi.resetModules());

  it("401 when unauthorized", async () => {
    const { list } = await loadRoutes({ user: "unauthorized" });
    const res = await list.GET(new Request("http://x/api/marketing/segments"));
    expect(res.status).toBe(401);
  });

  it("403 when accountant", async () => {
    const { list } = await loadRoutes({ user: ACCOUNTANT });
    const res = await list.GET(new Request("http://x/api/marketing/segments"));
    expect(res.status).toBe(403);
  });

  it("200 returns rows; query is scoped to business + active rows", async () => {
    const { list, supabase } = await loadRoutes({
      supabaseHandlers: {
        customer_segments: async () => ({
          data: [
            {
              id: AUTO_SEGMENT_ID,
              business_id: OWNER.businessId,
              name: "VIP",
              kind: "auto",
              auto_key: "vip",
              member_count: 5,
              member_count_at: new Date().toISOString(),
            },
          ],
          error: null,
        }),
      },
    });
    const res = await list.GET(new Request("http://x/api/marketing/segments"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    const q = supabase.queries.find((q) => q.table === "customer_segments");
    expect(q).toBeDefined();
    const ops = q!.ops.map((o) => o.method);
    expect(ops).toContain("eq");
    expect(ops).toContain("is");
    // tenant scope assert
    const eqCall = q!.ops.find(
      (o) => o.method === "eq" && o.args[0] === "business_id",
    );
    expect(eqCall?.args[1]).toBe(OWNER.businessId);
  });
});

describe("POST /api/marketing/segments", () => {
  it("400 when body is missing name", async () => {
    const { list } = await loadRoutes({});
    const res = await list.POST(
      new Request("http://x/api/marketing/segments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rules: {} }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when rules has unknown key", async () => {
    const { list } = await loadRoutes({});
    const res = await list.POST(
      new Request("http://x/api/marketing/segments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "x", rules: { foo: 1 } }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("201 on happy path; inserts kind='custom' + caller's business_id", async () => {
    const { list, supabase } = await loadRoutes({
      supabaseHandlers: {
        customer_segments: async () => ({
          data: {
            id: SEGMENT_ID,
            business_id: OWNER.businessId,
            name: "Test",
            kind: "custom",
            auto_key: null,
            rules: {},
            member_count: 0,
            member_count_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      },
    });
    const res = await list.POST(
      new Request("http://x/api/marketing/segments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          rules: { min_spend_myr: 500 },
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe(SEGMENT_ID);
    const insertCall = supabase.queries[0].ops.find(
      (o) => o.method === "insert",
    );
    expect(insertCall).toBeDefined();
    const row = (insertCall!.args[0] as Record<string, unknown>);
    expect(row.business_id).toBe(OWNER.businessId);
    expect(row.kind).toBe("custom");
    expect(row.auto_key).toBeNull();
  });
});

describe("PATCH /api/marketing/segments/[id]", () => {
  it("409 auto_immutable when target is auto", async () => {
    const { detail } = await loadRoutes({
      supabaseHandlers: {
        customer_segments: async (q) => {
          if (q.ops.some((o) => o.method === "update")) {
            return { data: null, error: null };
          }
          return {
            data: { id: AUTO_SEGMENT_ID, kind: "auto", deleted_at: null },
            error: null,
          };
        },
      },
    });
    const res = await detail.PATCH(
      new Request(`http://x/api/marketing/segments/${AUTO_SEGMENT_ID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "renamed" }),
      }),
      { params: Promise.resolve({ id: AUTO_SEGMENT_ID }) },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("auto_immutable");
  });

  it("200 on name-only patch of custom segment", async () => {
    let calls = 0;
    const { detail } = await loadRoutes({
      supabaseHandlers: {
        customer_segments: async () => {
          calls += 1;
          if (calls === 1) {
            return {
              data: { id: SEGMENT_ID, kind: "custom", deleted_at: null },
              error: null,
            };
          }
          return {
            data: {
              id: SEGMENT_ID,
              business_id: OWNER.businessId,
              name: "renamed",
              kind: "custom",
              auto_key: null,
              rules: { min_spend_myr: 500 },
              member_count: 1,
              member_count_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          };
        },
      },
    });
    const res = await detail.PATCH(
      new Request(`http://x/api/marketing/segments/${SEGMENT_ID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "renamed" }),
      }),
      { params: Promise.resolve({ id: SEGMENT_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("renamed");
  });
});

describe("DELETE /api/marketing/segments/[id]", () => {
  it("409 auto_immutable when target is auto", async () => {
    const { detail } = await loadRoutes({
      supabaseHandlers: {
        customer_segments: async () => ({
          data: { id: AUTO_SEGMENT_ID, kind: "auto", deleted_at: null },
          error: null,
        }),
      },
    });
    const res = await detail.DELETE(
      new Request(`http://x/api/marketing/segments/${AUTO_SEGMENT_ID}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: AUTO_SEGMENT_ID }) },
    );
    expect(res.status).toBe(409);
  });

  it("200 ok on custom segment", async () => {
    let calls = 0;
    const { detail, supabase } = await loadRoutes({
      supabaseHandlers: {
        customer_segments: async () => {
          calls += 1;
          if (calls === 1) {
            return {
              data: { id: SEGMENT_ID, kind: "custom", deleted_at: null },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      },
    });
    const res = await detail.DELETE(
      new Request(`http://x/api/marketing/segments/${SEGMENT_ID}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: SEGMENT_ID }) },
    );
    expect(res.status).toBe(200);
    // 2nd query is the update (soft-delete)
    const updateQuery = supabase.queries[1];
    const updateCall = updateQuery.ops.find((o) => o.method === "update");
    expect(updateCall).toBeDefined();
    const patch = updateCall!.args[0] as Record<string, unknown>;
    expect(typeof patch.deleted_at).toBe("string");
  });
});

describe("GET /api/marketing/segments/[id]/members — pagination", () => {
  it("returns members + nextCursor when there are more rows than the limit", async () => {
    let calls = 0;
    const members = Array.from({ length: 11 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      name: `Customer ${i}`,
      phone_e164: null,
      email: null,
      manual_tags: [],
      auto_tags: [],
      total_spend_myr: 100,
      order_count: 1,
      last_purchase_at: null,
    }));

    const { members: route } = await loadRoutes({
      supabaseHandlers: {
        customer_segments: async () => ({
          data: {
            id: SEGMENT_ID,
            business_id: OWNER.businessId,
            name: "Test",
            kind: "custom",
            auto_key: null,
            rules: {},
            member_count: 0,
            member_count_at: null,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          },
          error: null,
        }),
        customers: async () => {
          calls += 1;
          return { data: members, error: null };
        },
      },
    });
    const res = await route.GET(
      new Request(
        `http://x/api/marketing/segments/${SEGMENT_ID}/members?limit=10`,
      ),
      { params: Promise.resolve({ id: SEGMENT_ID }) },
    );
    expect(res.status).toBe(200);
    expect(calls).toBe(1);
    const body = await res.json();
    expect(body.data).toHaveLength(10);
    expect(body.nextCursor).toBe(members[9].id);
  });
});

describe("POST /api/marketing/segments/preview-count", () => {
  it("returns count for the caller's business", async () => {
    const { preview, supabase } = await loadRoutes({
      supabaseHandlers: {
        customers: async () => ({ count: 42, data: null, error: null }),
      },
    });
    const res = await preview.POST(
      new Request("http://x/api/marketing/segments/preview-count", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ min_spend_myr: 100 }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(42);
    const q = supabase.queries[0];
    const eqCall = q.ops.find(
      (o) => o.method === "eq" && o.args[0] === "business_id",
    );
    expect(eqCall?.args[1]).toBe(OWNER.businessId);
  });

  it("400 on invalid rules JSON", async () => {
    const { preview } = await loadRoutes({});
    const res = await preview.POST(
      new Request("http://x/api/marketing/segments/preview-count", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ foo: "bar" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
