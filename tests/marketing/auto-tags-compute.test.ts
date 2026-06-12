/**
 * Bantu Niaga — Marketing M4 unit tests for `computeAutoTags`.
 *
 * Table-driven coverage per the plan §10.1:
 *   - each of the 5 segments individually
 *   - combinations (vip + repeat, vip + at-risk, dormant + at-risk
 *     boundary, etc.)
 *   - boundary days (29 vs 30 vs 31, 59 vs 60, 89 vs 90 vs 91, 179 vs 180)
 *   - last_purchase_at null short-circuits dormant / at-risk / new
 *   - empty result for a brand-new customer with no purchase yet
 *
 * Pure TS — no DB. The integration test
 * `auto-tags-apply.test.ts` exercises the SQL implementation against
 * the live Supabase project to confirm they agree.
 */
import { describe, expect, it } from "vitest";
import {
  AUTO_TAG_THRESHOLDS,
  arraysEqual,
  computeAutoTags,
  tagSetDiff,
  type AutoTagInput,
} from "@/lib/marketing/auto-tags";

const NOW = new Date("2026-06-13T00:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function input(overrides: Partial<AutoTagInput> = {}): AutoTagInput {
  return {
    created_at: daysAgo(1),
    order_count: 0,
    total_spend_myr: 0,
    last_purchase_at: null,
    ...overrides,
  };
}

describe("computeAutoTags — individual segments", () => {
  it("tags `new` for a single recent purchase within 30 days", () => {
    expect(
      computeAutoTags(
        input({
          order_count: 1,
          total_spend_myr: 50,
          last_purchase_at: daysAgo(5),
        }),
        NOW,
      ),
    ).toEqual(["new"]);
  });

  it("tags `repeat` once order_count >= 2 (and no other segment)", () => {
    expect(
      computeAutoTags(
        input({
          order_count: 3,
          total_spend_myr: 250,
          last_purchase_at: daysAgo(10),
        }),
        NOW,
      ),
    ).toEqual(["repeat"]);
  });

  it("tags `vip` on total_spend_myr >= 1000 with low order count", () => {
    expect(
      computeAutoTags(
        input({
          order_count: 1,
          total_spend_myr: 1200,
          last_purchase_at: daysAgo(5),
        }),
        NOW,
      ),
    ).toEqual(["new", "vip"]);
  });

  it("tags `vip` on order_count >= 10 even with modest spend", () => {
    expect(
      computeAutoTags(
        input({
          order_count: 12,
          total_spend_myr: 400,
          last_purchase_at: daysAgo(10),
        }),
        NOW,
      ),
    ).toEqual(["repeat", "vip"]);
  });

  it("tags `dormant` when last purchase is > 90 days ago", () => {
    expect(
      computeAutoTags(
        input({
          order_count: 1,
          total_spend_myr: 80,
          last_purchase_at: daysAgo(120),
        }),
        NOW,
      ),
    ).toEqual(["dormant"]);
  });

  it("tags `at-risk` for a repeat customer 75 days dormant", () => {
    expect(
      computeAutoTags(
        input({
          order_count: 4,
          total_spend_myr: 300,
          last_purchase_at: daysAgo(75),
        }),
        NOW,
      ),
    ).toEqual(["at-risk", "repeat"]);
  });
});

describe("computeAutoTags — combinations", () => {
  it("vip + repeat for a high-spend repeat customer", () => {
    expect(
      computeAutoTags(
        input({
          order_count: 5,
          total_spend_myr: 2500,
          last_purchase_at: daysAgo(10),
        }),
        NOW,
      ),
    ).toEqual(["repeat", "vip"]);
  });

  it("vip + repeat + at-risk for a high-spend customer 70 days dormant", () => {
    expect(
      computeAutoTags(
        input({
          order_count: 5,
          total_spend_myr: 2500,
          last_purchase_at: daysAgo(70),
        }),
        NOW,
      ),
    ).toEqual(["at-risk", "repeat", "vip"]);
  });

  it("vip + dormant for a high-spend customer > 90 days dormant", () => {
    expect(
      computeAutoTags(
        input({
          order_count: 5,
          total_spend_myr: 2500,
          last_purchase_at: daysAgo(120),
        }),
        NOW,
      ),
    ).toEqual(["dormant", "repeat", "vip"]);
  });

  it("returns empty array for a never-purchased customer", () => {
    expect(
      computeAutoTags(
        input({ order_count: 0, total_spend_myr: 0, last_purchase_at: null }),
        NOW,
      ),
    ).toEqual([]);
  });

  it("returns empty array for a long-ago created never-purchased customer", () => {
    expect(
      computeAutoTags(
        input({
          created_at: daysAgo(120),
          order_count: 0,
          total_spend_myr: 0,
          last_purchase_at: null,
        }),
        NOW,
      ),
    ).toEqual([]);
  });
});

describe("computeAutoTags — boundary days", () => {
  it("`new` includes purchases strictly less than 30 days ago", () => {
    expect(
      computeAutoTags(
        input({ order_count: 1, last_purchase_at: daysAgo(29) }),
        NOW,
      ),
    ).toContain("new");
  });

  it("`new` excludes purchases exactly 30 days ago", () => {
    // last_purchase_at exactly 30 * MS_PER_DAY ago → daysSince === 30,
    // which is NOT < 30.
    expect(
      computeAutoTags(
        input({ order_count: 1, last_purchase_at: daysAgo(30) }),
        NOW,
      ),
    ).not.toContain("new");
  });

  it("`new` excluded once order_count >= 2", () => {
    expect(
      computeAutoTags(
        input({ order_count: 2, last_purchase_at: daysAgo(5) }),
        NOW,
      ),
    ).not.toContain("new");
  });

  it("`at-risk` excludes purchases exactly 60 days ago (boundary)", () => {
    expect(
      computeAutoTags(
        input({
          order_count: 3,
          total_spend_myr: 200,
          last_purchase_at: daysAgo(60),
        }),
        NOW,
      ),
    ).not.toContain("at-risk");
  });

  it("`at-risk` includes purchases between 60 (exclusive) and 90 (inclusive) days ago", () => {
    for (const d of [61, 75, 89, 90]) {
      expect(
        computeAutoTags(
          input({
            order_count: 3,
            total_spend_myr: 200,
            last_purchase_at: daysAgo(d),
          }),
          NOW,
        ),
      ).toContain("at-risk");
    }
  });

  it("`at-risk` excludes purchases > 90 days ago (dormant instead)", () => {
    const tags = computeAutoTags(
      input({
        order_count: 3,
        total_spend_myr: 200,
        last_purchase_at: daysAgo(91),
      }),
      NOW,
    );
    expect(tags).toContain("dormant");
    expect(tags).not.toContain("at-risk");
  });

  it("`dormant` includes purchases exactly 91+ days ago, excludes 90 days exact", () => {
    expect(
      computeAutoTags(
        input({
          order_count: 1,
          total_spend_myr: 50,
          last_purchase_at: daysAgo(90),
        }),
        NOW,
      ),
    ).not.toContain("dormant");
    expect(
      computeAutoTags(
        input({
          order_count: 1,
          total_spend_myr: 50,
          last_purchase_at: daysAgo(91),
        }),
        NOW,
      ),
    ).toContain("dormant");
  });

  it("`vip` excluded when total_spend strictly below 1000 and order_count below 10", () => {
    expect(
      computeAutoTags(
        input({
          order_count: 9,
          total_spend_myr: 999.99,
          last_purchase_at: daysAgo(5),
        }),
        NOW,
      ),
    ).not.toContain("vip");
  });

  it("`vip` triggers at exactly 1000 total spend (boundary inclusive)", () => {
    expect(
      computeAutoTags(
        input({
          order_count: 1,
          total_spend_myr: AUTO_TAG_THRESHOLDS.VIP_TOTAL_SPEND_MYR,
          last_purchase_at: daysAgo(5),
        }),
        NOW,
      ),
    ).toContain("vip");
  });

  it("`vip` triggers at exactly 10 order_count (boundary inclusive)", () => {
    expect(
      computeAutoTags(
        input({
          order_count: AUTO_TAG_THRESHOLDS.VIP_ORDER_COUNT,
          total_spend_myr: 50,
          last_purchase_at: daysAgo(5),
        }),
        NOW,
      ),
    ).toContain("vip");
  });
});

describe("computeAutoTags — null last_purchase_at edge cases", () => {
  it("never returns `dormant` for a customer with no purchase", () => {
    expect(
      computeAutoTags(
        input({ last_purchase_at: null, order_count: 0 }),
        NOW,
      ),
    ).not.toContain("dormant");
  });

  it("never returns `at-risk` for a customer with no purchase", () => {
    // Could otherwise trip if we allowed wasEngaged via order_count alone.
    expect(
      computeAutoTags(
        input({ last_purchase_at: null, order_count: 0, total_spend_myr: 2000 }),
        NOW,
      ),
    ).not.toContain("at-risk");
  });

  it("never returns `new` for a customer with no purchase", () => {
    expect(
      computeAutoTags(
        input({ last_purchase_at: null, order_count: 0 }),
        NOW,
      ),
    ).not.toContain("new");
  });
});

describe("computeAutoTags — return shape", () => {
  it("returns a sorted, deduped array (alphabetic)", () => {
    const tags = computeAutoTags(
      input({
        order_count: 5,
        total_spend_myr: 2500,
        last_purchase_at: daysAgo(70),
      }),
      NOW,
    );
    const sorted = [...tags].sort();
    expect(tags).toEqual(sorted);
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe("arraysEqual + tagSetDiff", () => {
  it("arraysEqual returns true for identical sorted arrays", () => {
    expect(arraysEqual(["a", "b"], ["a", "b"])).toBe(true);
    expect(arraysEqual([], [])).toBe(true);
  });

  it("arraysEqual returns false for different lengths or contents", () => {
    expect(arraysEqual(["a"], ["a", "b"])).toBe(false);
    expect(arraysEqual(["a", "b"], ["a", "c"])).toBe(false);
  });

  it("tagSetDiff returns added/removed correctly", () => {
    expect(tagSetDiff(["repeat"], ["repeat", "at-risk"])).toEqual({
      added: ["at-risk"],
      removed: [],
    });
    expect(tagSetDiff(["repeat", "vip"], ["dormant", "vip"])).toEqual({
      added: ["dormant"],
      removed: ["repeat"],
    });
    expect(tagSetDiff([], ["new"])).toEqual({ added: ["new"], removed: [] });
    expect(tagSetDiff(["new"], [])).toEqual({ added: [], removed: ["new"] });
  });
});
