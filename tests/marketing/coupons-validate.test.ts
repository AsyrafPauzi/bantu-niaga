/**
 * Unit tests for the coupon validate / redeem core (lib/marketing/coupons.ts).
 *
 * Strategy: mock supabase-js at the query-builder level via a hand-rolled
 * recorder so we can drive every spec §4 failure reason + the happy paths
 * without a live DB. Pure-logic tests cover the discount math + the code
 * generator.
 */
import { describe, expect, it } from "vitest";
import {
  computeDiscountMyr,
  generateCouponCode,
  validateCoupon,
  redeemCoupon,
  COUPON_FAILURE_REASONS,
  type CouponFailureReason,
} from "@/lib/marketing/coupons";

const BIZ = "00000000-0000-0000-0000-000000000aaa";
const COUPON_ID = "20000000-0000-4000-8000-0000000000c1";
const CUSTOMER_ID = "30000000-0000-4000-8000-000000000c11";

// ─────────────────────────────────────────────────────────────────────────
// computeDiscountMyr
// ─────────────────────────────────────────────────────────────────────────

describe("computeDiscountMyr", () => {
  it("PCT 20% on RM100 → RM20", () => {
    expect(computeDiscountMyr({ type: "PCT", value: 20 }, 100)).toBe(20);
  });
  it("PCT 12.5% on RM77 → RM9.63 (rounded to 2dp)", () => {
    expect(computeDiscountMyr({ type: "PCT", value: 12.5 }, 77)).toBe(9.63);
  });
  it("AMT 10 on RM50 → RM10", () => {
    expect(computeDiscountMyr({ type: "AMT", value: 10 }, 50)).toBe(10);
  });
  it("AMT 50 on RM30 → RM30 (capped at subtotal)", () => {
    expect(computeDiscountMyr({ type: "AMT", value: 50 }, 30)).toBe(30);
  });
  it("non-positive subtotal → 0", () => {
    expect(computeDiscountMyr({ type: "PCT", value: 50 }, 0)).toBe(0);
    expect(computeDiscountMyr({ type: "PCT", value: 50 }, -10)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// generateCouponCode
// ─────────────────────────────────────────────────────────────────────────

describe("generateCouponCode", () => {
  it("yields a string of the requested length", () => {
    expect(generateCouponCode(8)).toHaveLength(8);
    expect(generateCouponCode(12)).toHaveLength(12);
  });
  it("contains only the readable alphabet (no I/O/0/1)", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateCouponCode(16);
      expect(c).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
      expect(c).not.toMatch(/[IO01]/);
    }
  });
  it("rejects out-of-range lengths", () => {
    expect(() => generateCouponCode(2)).toThrow();
    expect(() => generateCouponCode(33)).toThrow();
  });
  it("COUPON_FAILURE_REASONS exposes every spec §4 reason", () => {
    expect(COUPON_FAILURE_REASONS).toContain("not_found");
    expect(COUPON_FAILURE_REASONS).toContain("paused");
    expect(COUPON_FAILURE_REASONS).toContain("expired");
    expect(COUPON_FAILURE_REASONS).toContain("not_yet_active");
    expect(COUPON_FAILURE_REASONS).toContain("min_subtotal");
    expect(COUPON_FAILURE_REASONS).toContain("total_limit_reached");
    expect(COUPON_FAILURE_REASONS).toContain("per_customer_limit_reached");
    expect(COUPON_FAILURE_REASONS).toContain("segment_mismatch");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// validateCoupon — supabase stub recorder
// ─────────────────────────────────────────────────────────────────────────

interface StubRow {
  table: string;
  ops: { method: string; args: unknown[] }[];
}

interface StubHandlerInput {
  ops: { method: string; args: unknown[] }[];
}

type StubHandler = (input: StubHandlerInput) => Promise<unknown>;

interface SupabaseStub {
  rows: StubRow[];
  from(table: string): unknown;
  rpc(name: string, args: Record<string, unknown>): Promise<unknown>;
}

function makeSupabase(handlers: {
  coupons?: StubHandler;
  coupon_redemptions?: StubHandler;
  customer_segments?: StubHandler;
  customers?: StubHandler;
  rpc?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}): SupabaseStub {
  const rows: StubRow[] = [];

  function from(table: string) {
    const row: StubRow = { table, ops: [] };
    rows.push(row);

    function method(name: string) {
      return (...args: unknown[]) => {
        row.ops.push({ method: name, args });
        return chain;
      };
    }

    const chain: Record<string, unknown> = {
      select: method("select"),
      insert: method("insert"),
      update: method("update"),
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
      maybeSingle: method("maybeSingle"),
      single: method("single"),
      then(onResolve: (value: unknown) => unknown) {
        const handler =
          (table === "coupons" && handlers.coupons) ||
          (table === "coupon_redemptions" && handlers.coupon_redemptions) ||
          (table === "customer_segments" && handlers.customer_segments) ||
          (table === "customers" && handlers.customers) ||
          (async () => ({ data: null, error: null }));
        return handler({ ops: row.ops }).then(onResolve);
      },
    };

    return chain;
  }

  return {
    rows,
    from,
    rpc: (name: string, args: Record<string, unknown>) => {
      if (handlers.rpc) return handlers.rpc(name, args);
      return Promise.resolve({ data: 1, error: null });
    },
  };
}

// Helper that returns a fully-populated coupon row (numerics as strings,
// matching what postgres-js actually returns).
function couponRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COUPON_ID,
    business_id: BIZ,
    code: "RAYA20",
    name: "Hari Raya 20%",
    type: "PCT",
    value: "20",
    min_subtotal_myr: "50",
    valid_from: "2026-01-01T00:00:00Z",
    valid_until: "2027-01-01T00:00:00Z",
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

// ─────────────────────────────────────────────────────────────────────────
// validateCoupon — every failure reason
// ─────────────────────────────────────────────────────────────────────────

describe("validateCoupon — failure reasons", () => {
  const NOW = new Date("2026-06-15T00:00:00Z");

  async function expectReason(
    handlers: Parameters<typeof makeSupabase>[0],
    inputs: { code?: string; customer?: string | null; subtotal?: number },
    reason: CouponFailureReason,
  ) {
    const supabase = makeSupabase(handlers) as unknown as Parameters<
      typeof validateCoupon
    >[0]["supabase"];
    const result = await validateCoupon({
      supabase,
      businessId: BIZ,
      code: inputs.code ?? "RAYA20",
      customerId: inputs.customer === undefined ? CUSTOMER_ID : inputs.customer,
      subtotalMyr: inputs.subtotal ?? 100,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(reason);
    }
  }

  it("not_found — empty code", async () => {
    await expectReason({}, { code: "  " }, "not_found");
  });

  it("not_found — no row returned", async () => {
    await expectReason(
      { coupons: async () => ({ data: null, error: null }) },
      {},
      "not_found",
    );
  });

  it("paused", async () => {
    await expectReason(
      {
        coupons: async () => ({
          data: couponRow({ status: "paused" }),
          error: null,
        }),
      },
      {},
      "paused",
    );
  });

  it("expired — status='expired'", async () => {
    await expectReason(
      {
        coupons: async () => ({
          data: couponRow({ status: "expired" }),
          error: null,
        }),
      },
      {},
      "expired",
    );
  });

  it("expired — valid_until in the past", async () => {
    await expectReason(
      {
        coupons: async () => ({
          data: couponRow({ valid_until: "2026-01-02T00:00:00Z" }),
          error: null,
        }),
      },
      {},
      "expired",
    );
  });

  it("not_yet_active", async () => {
    await expectReason(
      {
        coupons: async () => ({
          data: couponRow({ valid_from: "2027-01-01T00:00:00Z" }),
          error: null,
        }),
      },
      {},
      "not_yet_active",
    );
  });

  it("min_subtotal", async () => {
    await expectReason(
      {
        coupons: async () => ({
          data: couponRow({ min_subtotal_myr: "100" }),
          error: null,
        }),
      },
      { subtotal: 50 },
      "min_subtotal",
    );
  });

  it("total_limit_reached", async () => {
    await expectReason(
      {
        coupons: async () => ({
          data: couponRow({ total_limit: 10, redeemed_count: 10 }),
          error: null,
        }),
      },
      {},
      "total_limit_reached",
    );
  });

  it("per_customer_limit_reached", async () => {
    await expectReason(
      {
        coupons: async () => ({
          data: couponRow({ per_customer_limit: 1 }),
          error: null,
        }),
        coupon_redemptions: async () => ({
          count: 1,
          data: null,
          error: null,
        }),
      },
      {},
      "per_customer_limit_reached",
    );
  });

  it("segment_mismatch — customer not a member", async () => {
    await expectReason(
      {
        coupons: async () => ({
          data: couponRow({
            segment_id: "40000000-0000-4000-8000-000000000111",
          }),
          error: null,
        }),
        coupon_redemptions: async () => ({ count: 0, error: null }),
        customer_segments: async () => ({
          data: {
            id: "40000000-0000-4000-8000-000000000111",
            business_id: BIZ,
            name: "Big spenders",
            kind: "custom",
            auto_key: null,
            rules: { min_spend_myr: 500 },
            member_count: 0,
            member_count_at: null,
            created_by: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            deleted_at: null,
          },
          error: null,
        }),
        customers: async () => ({ count: 0, error: null }),
      },
      {},
      "segment_mismatch",
    );
  });
});

describe("validateCoupon — happy paths", () => {
  const NOW = new Date("2026-06-15T00:00:00Z");

  it("ok PCT 20% on RM100 returns discount=20", async () => {
    const supabase = makeSupabase({
      coupons: async () => ({ data: couponRow(), error: null }),
      coupon_redemptions: async () => ({ count: 0, error: null }),
    }) as unknown as Parameters<typeof validateCoupon>[0]["supabase"];
    const result = await validateCoupon({
      supabase,
      businessId: BIZ,
      code: "RAYA20",
      customerId: CUSTOMER_ID,
      subtotalMyr: 100,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.discount_myr).toBe(20);
      expect(result.coupon.code).toBe("RAYA20");
    }
  });

  it("ok AMT RM10 on RM50 returns discount=10", async () => {
    const supabase = makeSupabase({
      coupons: async () => ({
        data: couponRow({ type: "AMT", value: "10", min_subtotal_myr: "0" }),
        error: null,
      }),
      coupon_redemptions: async () => ({ count: 0, error: null }),
    }) as unknown as Parameters<typeof validateCoupon>[0]["supabase"];
    const result = await validateCoupon({
      supabase,
      businessId: BIZ,
      code: "WELCOME10",
      customerId: null,
      subtotalMyr: 50,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.discount_myr).toBe(10);
    }
  });

  it("date boundary: valid_until exactly = now is treated as expired (inclusive)", async () => {
    const supabase = makeSupabase({
      coupons: async () => ({
        data: couponRow({ valid_until: NOW.toISOString() }),
        error: null,
      }),
      coupon_redemptions: async () => ({ count: 0, error: null }),
    }) as unknown as Parameters<typeof validateCoupon>[0]["supabase"];
    const result = await validateCoupon({
      supabase,
      businessId: BIZ,
      code: "RAYA20",
      customerId: CUSTOMER_ID,
      subtotalMyr: 100,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("min_subtotal exactly equals min → ok (boundary inclusive)", async () => {
    const supabase = makeSupabase({
      coupons: async () => ({
        data: couponRow({ min_subtotal_myr: "50" }),
        error: null,
      }),
      coupon_redemptions: async () => ({ count: 0, error: null }),
    }) as unknown as Parameters<typeof validateCoupon>[0]["supabase"];
    const result = await validateCoupon({
      supabase,
      businessId: BIZ,
      code: "RAYA20",
      customerId: CUSTOMER_ID,
      subtotalMyr: 50,
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// redeemCoupon — happy + idempotency
// ─────────────────────────────────────────────────────────────────────────

describe("redeemCoupon", () => {
  const NOW = new Date("2026-06-15T00:00:00Z");

  it("happy path inserts redemption + bumps counter via RPC", async () => {
    let inserted = false;
    let rpcCalled = false;
    const supabase = makeSupabase({
      coupons: async ({ ops }) => {
        const isInsert = ops.some((o) => o.method === "insert");
        const isUpdate = ops.some((o) => o.method === "update");
        if (isInsert || isUpdate) {
          return { data: null, error: null };
        }
        return { data: couponRow(), error: null };
      },
      coupon_redemptions: async ({ ops }) => {
        const isInsert = ops.some((o) => o.method === "insert");
        if (isInsert) {
          inserted = true;
          return {
            data: {
              id: "50000000-0000-4000-8000-0000000000aa",
              coupon_id: COUPON_ID,
              customer_id: CUSTOMER_ID,
              order_ref: null,
              discount_amount_myr: "20",
              redeemed_by: null,
              redeemed_at: NOW.toISOString(),
            },
            error: null,
          };
        }
        return { count: 0, error: null };
      },
      rpc: async () => {
        rpcCalled = true;
        return { data: 1, error: null };
      },
    }) as unknown as Parameters<typeof redeemCoupon>[0]["serviceClient"];

    const result = await redeemCoupon({
      serviceClient: supabase,
      businessId: BIZ,
      code: "RAYA20",
      customerId: CUSTOMER_ID,
      subtotalMyr: 100,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.idempotent).toBe(false);
      expect(result.redemption.discount_amount_myr).toBe(20);
      expect(result.coupon.redeemed_count).toBe(1);
    }
    expect(inserted).toBe(true);
    expect(rpcCalled).toBe(true);
  });

  it("idempotency: returns existing row on duplicate order_ref without RPC", async () => {
    let rpcCalled = false;
    const existingRow = {
      id: "50000000-0000-4000-8000-0000000000bb",
      coupon_id: COUPON_ID,
      customer_id: CUSTOMER_ID,
      order_ref: "INV-001",
      discount_amount_myr: "20",
      redeemed_by: null,
      redeemed_at: NOW.toISOString(),
    };
    const supabase = makeSupabase({
      coupons: async () => ({ data: couponRow(), error: null }),
      coupon_redemptions: async () => ({ data: existingRow, error: null }),
      rpc: async () => {
        rpcCalled = true;
        return { data: 999, error: null };
      },
    }) as unknown as Parameters<typeof redeemCoupon>[0]["serviceClient"];

    const result = await redeemCoupon({
      serviceClient: supabase,
      businessId: BIZ,
      code: "RAYA20",
      customerId: CUSTOMER_ID,
      orderRef: "INV-001",
      subtotalMyr: 100,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.idempotent).toBe(true);
      expect(result.redemption.id).toBe(existingRow.id);
    }
    expect(rpcCalled).toBe(false);
  });

  it("propagates validation failure (does NOT insert)", async () => {
    let inserted = false;
    const supabase = makeSupabase({
      coupons: async () => ({
        data: couponRow({ status: "paused" }),
        error: null,
      }),
      coupon_redemptions: async ({ ops }) => {
        if (ops.some((o) => o.method === "insert")) inserted = true;
        return { count: 0, error: null };
      },
    }) as unknown as Parameters<typeof redeemCoupon>[0]["serviceClient"];

    const result = await redeemCoupon({
      serviceClient: supabase,
      businessId: BIZ,
      code: "RAYA20",
      customerId: CUSTOMER_ID,
      subtotalMyr: 100,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("paused");
    expect(inserted).toBe(false);
  });
});
