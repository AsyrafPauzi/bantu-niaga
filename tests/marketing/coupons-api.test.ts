/**
 * Integration tests for /api/marketing/coupons routes.
 *
 * Strategy mirrors tests/marketing/segments-api.test.ts: mock
 * `getCurrentUser` + `createSupabaseServerClient` at the module
 * boundary and route the supabase-js builder calls through a
 * recording stub. We exercise the real handler logic — schema
 * validation, RBAC, RLS scoping — without a live DB.
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

const CASHIER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000dd",
  role: "cashier",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

const COUPON_ID = "20000000-0000-4000-8000-0000000000c1";
const CUSTOMER_ID = "30000000-0000-4000-8000-000000000c11";

interface QueryStub {
  table: string;
  ops: { method: string; args: unknown[] }[];
  resolve?: () => Promise<unknown>;
}

interface SupabaseStub {
  queries: QueryStub[];
  rpcCalls: { name: string; args: unknown }[];
  from: (table: string) => Record<string, unknown>;
  rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

function makeSupabaseStub(
  handlers: Record<
    string,
    (q: QueryStub, callIdx: number) => Promise<unknown>
  >,
  rpcHandler?: (name: string, args: Record<string, unknown>) => Promise<unknown>,
): SupabaseStub {
  const queries: QueryStub[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];
  const callsPerTable = new Map<string, number>();

  function from(table: string) {
    const q: QueryStub = { table, ops: [] };
    queries.push(q);
    const idx = callsPerTable.get(table) ?? 0;
    callsPerTable.set(table, idx + 1);

    function method(name: string) {
      return (...args: unknown[]) => {
        q.ops.push({ method: name, args });
        return chain;
      };
    }
    function thenLike(onResolve: (value: unknown) => unknown) {
      const handler =
        handlers[`${table}:${q.ops.map((o) => o.method).join(",")}`] ??
        handlers[table] ??
        (async () => ({ data: null, error: null }));
      return handler(q, idx).then(onResolve);
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
      ilike: method("ilike"),
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

  return {
    queries,
    rpcCalls,
    from,
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (rpcHandler) return rpcHandler(name, args);
      return { data: 1, error: null };
    },
  };
}

async function loadRoutes(opts: {
  user?: CurrentUser | "unauthorized";
  supabaseHandlers?: Record<
    string,
    (q: QueryStub, callIdx: number) => Promise<unknown>
  >;
  rpcHandler?: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
}) {
  vi.resetModules();
  const { UnauthorizedError } = await import("@/lib/auth/current-user");

  vi.doMock("@/lib/auth/current-user", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/auth/current-user")
    >("@/lib/auth/current-user");
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

  const supabase = makeSupabaseStub(
    opts.supabaseHandlers ?? {},
    opts.rpcHandler,
  );
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => supabase),
  }));

  const list = await import("@/app/api/marketing/coupons/route");
  const detail = await import("@/app/api/marketing/coupons/[id]/route");
  const validate = await import(
    "@/app/api/marketing/coupons/validate/route"
  );
  const redeem = await import("@/app/api/marketing/coupons/redeem/route");

  return { list, detail, validate, redeem, supabase };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/auth/current-user");
  vi.doUnmock("@/lib/supabase/server");
});

function couponRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COUPON_ID,
    business_id: OWNER.businessId,
    code: "RAYA20",
    name: "Hari Raya 20%",
    type: "PCT",
    value: "20",
    min_subtotal_myr: "50",
    valid_from: "2026-01-01T00:00:00Z",
    valid_until: "2030-01-01T00:00:00Z",
    total_limit: null,
    per_customer_limit: 1,
    segment_id: null,
    status: "active",
    redeemed_count: 0,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("GET /api/marketing/coupons", () => {
  beforeEach(() => vi.resetModules());

  it("401 when unauthorized", async () => {
    const { list } = await loadRoutes({ user: "unauthorized" });
    const res = await list.GET(new Request("http://x/api/marketing/coupons"));
    expect(res.status).toBe(401);
  });

  it("403 when accountant", async () => {
    const { list } = await loadRoutes({ user: ACCOUNTANT });
    const res = await list.GET(new Request("http://x/api/marketing/coupons"));
    expect(res.status).toBe(403);
  });

  it("200 returns rows; query is scoped to business + non-deleted", async () => {
    const { list, supabase } = await loadRoutes({
      supabaseHandlers: {
        coupons: async () => ({ data: [couponRow()], error: null }),
      },
    });
    const res = await list.GET(new Request("http://x/api/marketing/coupons"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    const q = supabase.queries[0];
    expect(q.ops.some((o) => o.method === "is" && o.args[0] === "deleted_at")).toBe(
      true,
    );
    const eqBiz = q.ops.find(
      (o) => o.method === "eq" && o.args[0] === "business_id",
    );
    expect(eqBiz?.args[1]).toBe(OWNER.businessId);
  });
});

describe("POST /api/marketing/coupons", () => {
  it("400 when value is missing", async () => {
    const { list } = await loadRoutes({});
    const res = await list.POST(
      new Request("http://x/api/marketing/coupons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "PCT" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when PCT value is over 100", async () => {
    const { list } = await loadRoutes({});
    const res = await list.POST(
      new Request("http://x/api/marketing/coupons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "PCT", value: 200 }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("201 happy path; insert receives caller's business_id", async () => {
    const { list, supabase } = await loadRoutes({
      supabaseHandlers: {
        coupons: async () => ({ data: couponRow(), error: null }),
      },
    });
    const res = await list.POST(
      new Request("http://x/api/marketing/coupons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "PCT", value: 20 }),
      }),
    );
    expect(res.status).toBe(201);
    const insertCall = supabase.queries[0].ops.find(
      (o) => o.method === "insert",
    );
    expect(insertCall).toBeDefined();
    const row = insertCall!.args[0] as Record<string, unknown>;
    expect(row.business_id).toBe(OWNER.businessId);
    expect(row.type).toBe("PCT");
    expect(typeof row.code).toBe("string"); // auto-generated
  });

  it("409 when supplied code is already taken", async () => {
    const { list } = await loadRoutes({
      supabaseHandlers: {
        coupons: async () => ({
          data: null,
          error: { code: "23505", message: "duplicate key" },
        }),
      },
    });
    const res = await list.POST(
      new Request("http://x/api/marketing/coupons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "RAYA20", type: "PCT", value: 20 }),
      }),
    );
    expect(res.status).toBe(409);
  });
});

describe("GET /api/marketing/coupons/[id]", () => {
  it("404 when not found", async () => {
    const { detail } = await loadRoutes({
      supabaseHandlers: {
        coupons: async () => ({ data: null, error: null }),
      },
    });
    const res = await detail.GET(
      new Request(`http://x/api/marketing/coupons/${COUPON_ID}`),
      { params: Promise.resolve({ id: COUPON_ID }) },
    );
    expect(res.status).toBe(404);
  });

  it("200 returns coupon + redemptions", async () => {
    const { detail } = await loadRoutes({
      supabaseHandlers: {
        coupons: async () => ({ data: couponRow(), error: null }),
        coupon_redemptions: async () => ({
          data: [
            {
              id: "50000000-0000-4000-8000-0000000000aa",
              coupon_id: COUPON_ID,
              customer_id: CUSTOMER_ID,
              order_ref: null,
              discount_amount_myr: "20",
              redeemed_by: null,
              redeemed_at: "2026-06-01T00:00:00Z",
            },
          ],
          error: null,
        }),
        customers: async () => ({
          data: [{ id: CUSTOMER_ID, name: "Aida" }],
          error: null,
        }),
      },
    });
    const res = await detail.GET(
      new Request(`http://x/api/marketing/coupons/${COUPON_ID}`),
      { params: Promise.resolve({ id: COUPON_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(COUPON_ID);
    expect(body.data.redemptions).toHaveLength(1);
    expect(body.data.redemptions[0].customer_name).toBe("Aida");
  });
});

describe("PATCH /api/marketing/coupons/[id]", () => {
  it("409 when caller tries to mutate `code`", async () => {
    const { detail } = await loadRoutes({});
    const res = await detail.PATCH(
      new Request(`http://x/api/marketing/coupons/${COUPON_ID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "NEWCODE" }),
      }),
      { params: Promise.resolve({ id: COUPON_ID }) },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("code_immutable");
  });

  it("200 updates status from active to paused", async () => {
    let calls = 0;
    const { detail } = await loadRoutes({
      supabaseHandlers: {
        coupons: async () => {
          calls += 1;
          if (calls === 1) {
            return {
              data: { id: COUPON_ID, type: "PCT", value: 20, deleted_at: null },
              error: null,
            };
          }
          return { data: couponRow({ status: "paused" }), error: null };
        },
      },
    });
    const res = await detail.PATCH(
      new Request(`http://x/api/marketing/coupons/${COUPON_ID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      }),
      { params: Promise.resolve({ id: COUPON_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("paused");
  });
});

describe("DELETE /api/marketing/coupons/[id]", () => {
  it("409 when redeemed_count > 0", async () => {
    const { detail } = await loadRoutes({
      supabaseHandlers: {
        coupons: async () => ({
          data: { id: COUPON_ID, redeemed_count: 3, deleted_at: null },
          error: null,
        }),
      },
    });
    const res = await detail.DELETE(
      new Request(`http://x/api/marketing/coupons/${COUPON_ID}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: COUPON_ID }) },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("redeemed_already");
  });

  it("200 ok on never-redeemed coupon", async () => {
    let calls = 0;
    const { detail, supabase } = await loadRoutes({
      supabaseHandlers: {
        coupons: async () => {
          calls += 1;
          if (calls === 1) {
            return {
              data: { id: COUPON_ID, redeemed_count: 0, deleted_at: null },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      },
    });
    const res = await detail.DELETE(
      new Request(`http://x/api/marketing/coupons/${COUPON_ID}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: COUPON_ID }) },
    );
    expect(res.status).toBe(200);
    // 2nd query is the soft-delete UPDATE.
    const updateQuery = supabase.queries[1];
    const updateCall = updateQuery.ops.find((o) => o.method === "update");
    expect(updateCall).toBeDefined();
    const patch = updateCall!.args[0] as Record<string, unknown>;
    expect(typeof patch.deleted_at).toBe("string");
  });
});

describe("POST /api/marketing/coupons/validate", () => {
  it("permits cashier (forward-compat for POS)", async () => {
    const { validate } = await loadRoutes({
      user: CASHIER,
      supabaseHandlers: {
        coupons: async () => ({ data: couponRow(), error: null }),
        coupon_redemptions: async () => ({ count: 0, error: null }),
      },
    });
    const res = await validate.POST(
      new Request("http://x/api/marketing/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "RAYA20", subtotal_myr: 100 }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.discount_myr).toBe(20);
  });

  it("ok=false with reason=min_subtotal", async () => {
    const { validate } = await loadRoutes({
      supabaseHandlers: {
        coupons: async () => ({ data: couponRow(), error: null }),
      },
    });
    const res = await validate.POST(
      new Request("http://x/api/marketing/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "RAYA20", subtotal_myr: 10 }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("min_subtotal");
  });

  it("ok=false with reason=not_found", async () => {
    const { validate } = await loadRoutes({
      supabaseHandlers: {
        coupons: async () => ({ data: null, error: null }),
      },
    });
    const res = await validate.POST(
      new Request("http://x/api/marketing/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "MISSING", subtotal_myr: 100 }),
      }),
    );
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("not_found");
  });

  it("400 on invalid body", async () => {
    const { validate } = await loadRoutes({});
    const res = await validate.POST(
      new Request("http://x/api/marketing/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/marketing/coupons/redeem", () => {
  it("201 records a redemption + bumps counter", async () => {
    let bumped = false;
    const { redeem, supabase } = await loadRoutes({
      supabaseHandlers: {
        coupons: async () => ({ data: couponRow(), error: null }),
        coupon_redemptions: async (q) => {
          if (q.ops.some((o) => o.method === "insert")) {
            return {
              data: {
                id: "50000000-0000-4000-8000-0000000000aa",
                coupon_id: COUPON_ID,
                customer_id: CUSTOMER_ID,
                order_ref: null,
                discount_amount_myr: "20",
                redeemed_by: null,
                redeemed_at: "2026-06-15T00:00:00Z",
              },
              error: null,
            };
          }
          return { count: 0, error: null };
        },
      },
      rpcHandler: async () => {
        bumped = true;
        return { data: 1, error: null };
      },
    });
    const res = await redeem.POST(
      new Request("http://x/api/marketing/coupons/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: "RAYA20",
          customer_id: CUSTOMER_ID,
          subtotal_myr: 100,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.discount_myr).toBe(20);
    expect(bumped).toBe(true);
    expect(supabase.rpcCalls[0]?.name).toBe("increment_coupon_redeemed_count");
  });

  it("idempotent on duplicate order_ref → 200, no extra RPC", async () => {
    let rpcCount = 0;
    const { redeem } = await loadRoutes({
      supabaseHandlers: {
        coupons: async () => ({ data: couponRow(), error: null }),
        coupon_redemptions: async () => ({
          data: {
            id: "50000000-0000-4000-8000-0000000000aa",
            coupon_id: COUPON_ID,
            customer_id: CUSTOMER_ID,
            order_ref: "INV-001",
            discount_amount_myr: "20",
            redeemed_by: null,
            redeemed_at: "2026-06-15T00:00:00Z",
          },
          error: null,
        }),
      },
      rpcHandler: async () => {
        rpcCount += 1;
        return { data: 1, error: null };
      },
    });
    const res = await redeem.POST(
      new Request("http://x/api/marketing/coupons/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: "RAYA20",
          customer_id: CUSTOMER_ID,
          order_ref: "INV-001",
          subtotal_myr: 100,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.idempotent).toBe(true);
    expect(rpcCount).toBe(0);
  });
});
