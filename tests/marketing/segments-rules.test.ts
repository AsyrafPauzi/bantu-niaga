/**
 * Unit tests for the segment rule resolver.
 *
 * Covers compileRulesToSql + applyRulesToCustomersQuery + the small
 * helpers (isEmptyRules, autoKeyToCustomerTag).
 *
 * Strategy: exercise the SQL string view via `compileRulesToSql` for
 * documentation-friendly assertions, then verify the supabase-js
 * mutator emits the same shape via a recording stub. Each rule key is
 * tested in isolation and at least one AND-composition is verified.
 */
import { describe, expect, it } from "vitest";
import {
  applyRulesToCustomersQuery,
  autoKeyToCustomerTag,
  autoSegmentRules,
  compileRulesToSql,
  isEmptyRules,
  isSegmentRules,
  SegmentRulesSchema,
  type CustomersQueryLike,
  type SegmentRules,
} from "@/lib/marketing/segments-rules";

const BIZ = "00000000-0000-0000-0000-0000000000bb";

describe("autoKeyToCustomerTag", () => {
  it("maps at_risk → at-risk; identity otherwise", () => {
    expect(autoKeyToCustomerTag("vip")).toBe("vip");
    expect(autoKeyToCustomerTag("repeat")).toBe("repeat");
    expect(autoKeyToCustomerTag("new")).toBe("new");
    expect(autoKeyToCustomerTag("at_risk")).toBe("at-risk");
    expect(autoKeyToCustomerTag("dormant")).toBe("dormant");
  });
});

describe("isEmptyRules + autoSegmentRules", () => {
  it("recognises empty rules object as empty", () => {
    expect(isEmptyRules({})).toBe(true);
  });
  it("rules with only empty arrays still count as empty", () => {
    expect(
      isEmptyRules({ tags_any: [], sources: [], auto_tags_any: [] }),
    ).toBe(true);
  });
  it("any non-empty key marks the rules as non-empty", () => {
    expect(isEmptyRules({ min_spend_myr: 0 })).toBe(false);
    expect(isEmptyRules({ inactive_days: 0 })).toBe(false);
    expect(isEmptyRules({ tags_any: ["x"] })).toBe(false);
  });
  it("autoSegmentRules returns a one-key rules object", () => {
    expect(autoSegmentRules("vip")).toEqual({ auto_tags_any: ["vip"] });
  });
});

describe("SegmentRulesSchema", () => {
  it("rejects unknown keys", () => {
    const r = SegmentRulesSchema.safeParse({ foo: 1 });
    expect(r.success).toBe(false);
  });
  it("rejects invalid auto_tags_any values", () => {
    const r = SegmentRulesSchema.safeParse({
      auto_tags_any: ["not-a-real-tag"],
    });
    expect(r.success).toBe(false);
  });
  it("isSegmentRules narrows on success", () => {
    expect(isSegmentRules({ min_spend_myr: 100 })).toBe(true);
    expect(isSegmentRules({ totally: "bogus" })).toBe(false);
  });
});

describe("compileRulesToSql — base scope", () => {
  it("empty rules emits only the tenant + soft-delete scope", () => {
    const out = compileRulesToSql({}, BIZ);
    expect(out.whereClause).toBe(
      "business_id = :business_id AND deleted_at IS NULL AND merged_into_id IS NULL",
    );
    expect(out.params).toEqual({ business_id: BIZ });
  });
});

describe("compileRulesToSql — each rule key in isolation", () => {
  it("min_spend_myr emits a >= clause + binds the value", () => {
    const out = compileRulesToSql({ min_spend_myr: 500 }, BIZ);
    expect(out.whereClause).toContain("total_spend_myr >= :min_spend_myr");
    expect(out.params.min_spend_myr).toBe(500);
  });
  it("max_spend_myr emits a <= clause", () => {
    const out = compileRulesToSql({ max_spend_myr: 999 }, BIZ);
    expect(out.whereClause).toContain("total_spend_myr <= :max_spend_myr");
    expect(out.params.max_spend_myr).toBe(999);
  });
  it("inactive_days emits a null-or-old clause and binds the day count", () => {
    const out = compileRulesToSql({ inactive_days: 90 }, BIZ);
    expect(out.whereClause).toContain(
      "(last_purchase_at IS NULL OR last_purchase_at < (now() - (:inactive_days || ' days')::interval))",
    );
    expect(out.params.inactive_days).toBe(90);
  });
  it("sources emits an = ANY(...) clause", () => {
    const out = compileRulesToSql(
      { sources: ["manual", "pos"] },
      BIZ,
    );
    expect(out.whereClause).toContain("source = ANY(:sources::text[])");
    expect(out.params.sources).toEqual(["manual", "pos"]);
  });
  it("tags_any unions with manual_tags_any and matches either column", () => {
    const out = compileRulesToSql(
      { tags_any: ["a"], manual_tags_any: ["b"] },
      BIZ,
    );
    expect(out.whereClause).toContain(
      "(manual_tags && :string_tags::text[] OR auto_tags && :string_tags::text[])",
    );
    expect(out.params.string_tags).toEqual(["a", "b"]);
  });
  it("auto_tags_any maps at_risk → at-risk and emits overlap", () => {
    const out = compileRulesToSql(
      { auto_tags_any: ["vip", "at_risk"] },
      BIZ,
    );
    expect(out.whereClause).toContain("auto_tags && :auto_tags::text[]");
    expect(out.params.auto_tags).toEqual(["vip", "at-risk"]);
  });
});

describe("compileRulesToSql — AND-composition", () => {
  it("each non-empty key adds its own AND clause", () => {
    const rules: SegmentRules = {
      min_spend_myr: 100,
      inactive_days: 30,
      sources: ["manual"],
      auto_tags_any: ["vip"],
    };
    const out = compileRulesToSql(rules, BIZ);
    const clauses = out.whereClause.split(" AND ");
    // base 3 + 4 rule keys = 7
    expect(clauses).toHaveLength(7);
    expect(out.params).toMatchObject({
      business_id: BIZ,
      min_spend_myr: 100,
      inactive_days: 30,
      sources: ["manual"],
      auto_tags: ["vip"],
    });
  });
});

describe("compileRulesToSql — edge cases", () => {
  it("min_spend_myr=0 is included (boundary)", () => {
    const out = compileRulesToSql({ min_spend_myr: 0 }, BIZ);
    expect(out.whereClause).toContain("total_spend_myr >= :min_spend_myr");
    expect(out.params.min_spend_myr).toBe(0);
  });
  it("negative spend round-trips (validation is a layer above)", () => {
    const out = compileRulesToSql({ min_spend_myr: -50 }, BIZ);
    expect(out.params.min_spend_myr).toBe(-50);
  });
  it("inactive_days=0 still emits the clause", () => {
    const out = compileRulesToSql({ inactive_days: 0 }, BIZ);
    expect(out.params.inactive_days).toBe(0);
    expect(out.whereClause).toContain("(:inactive_days || ' days')");
  });
  it("future inactive_days (e.g. 365) round-trips as a normal int", () => {
    const out = compileRulesToSql({ inactive_days: 365 }, BIZ);
    expect(out.params.inactive_days).toBe(365);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// applyRulesToCustomersQuery — recorder stub
// ─────────────────────────────────────────────────────────────────────────

type Call = { method: string; args: unknown[] };
function makeQueryRecorder(): {
  calls: Call[];
  query: CustomersQueryLike;
} {
  const calls: Call[] = [];
  const proxy: CustomersQueryLike = {
    or(s: string) {
      calls.push({ method: "or", args: [s] });
      return proxy;
    },
    overlaps(c: string, v: unknown[]) {
      calls.push({ method: "overlaps", args: [c, v] });
      return proxy;
    },
    gte(c: string, v: number | string) {
      calls.push({ method: "gte", args: [c, v] });
      return proxy;
    },
    lte(c: string, v: number | string) {
      calls.push({ method: "lte", args: [c, v] });
      return proxy;
    },
    lt(c: string, v: string) {
      calls.push({ method: "lt", args: [c, v] });
      return proxy;
    },
    is(c: string, v: null | boolean) {
      calls.push({ method: "is", args: [c, v] });
      return proxy;
    },
    in(c: string, v: readonly string[]) {
      calls.push({ method: "in", args: [c, v] });
      return proxy;
    },
  };
  return { calls, query: proxy };
}

describe("applyRulesToCustomersQuery", () => {
  it("empty rules makes no calls", () => {
    const { calls, query } = makeQueryRecorder();
    applyRulesToCustomersQuery(query, {});
    expect(calls).toHaveLength(0);
  });

  it("min_spend_myr → .gte(total_spend_myr, n)", () => {
    const { calls, query } = makeQueryRecorder();
    applyRulesToCustomersQuery(query, { min_spend_myr: 100 });
    expect(calls).toContainEqual({
      method: "gte",
      args: ["total_spend_myr", 100],
    });
  });

  it("auto_tags_any → .overlaps with mapped tag values", () => {
    const { calls, query } = makeQueryRecorder();
    applyRulesToCustomersQuery(query, { auto_tags_any: ["at_risk", "vip"] });
    expect(calls).toContainEqual({
      method: "overlaps",
      args: ["auto_tags", ["at-risk", "vip"]],
    });
  });

  it("sources → .in('source', [...])", () => {
    const { calls, query } = makeQueryRecorder();
    applyRulesToCustomersQuery(query, { sources: ["manual"] });
    expect(calls).toContainEqual({
      method: "in",
      args: ["source", ["manual"]],
    });
  });

  it("inactive_days → .or() with date cutoff", () => {
    const { calls, query } = makeQueryRecorder();
    const now = new Date("2026-06-15T00:00:00.000Z");
    applyRulesToCustomersQuery(query, { inactive_days: 30 }, now);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("or");
    const filter = calls[0].args[0] as string;
    expect(filter).toContain("last_purchase_at.is.null");
    expect(filter).toContain("last_purchase_at.lt.2026-05-16T00:00:00.000Z");
  });

  it("tags_any + manual_tags_any → single .or() across both columns", () => {
    const { calls, query } = makeQueryRecorder();
    applyRulesToCustomersQuery(query, {
      tags_any: ["wholesale"],
      manual_tags_any: ["vip-buyer"],
    });
    const orCalls = calls.filter((c) => c.method === "or");
    expect(orCalls).toHaveLength(1);
    const filter = orCalls[0].args[0] as string;
    expect(filter).toContain("manual_tags.ov.");
    expect(filter).toContain("auto_tags.ov.");
  });
});
