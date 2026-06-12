/**
 * Pure-function tests for `classifyRow` in `lib/marketing/csv-classify.ts`.
 *
 * The classifier is the single source of truth for the per-row
 * import outcome (decisions doc Q9). These tests pin the decision
 * tree:
 *
 *   create  — clean row, no phone collision
 *   merge   — phone matches an existing live customer with the same name
 *   reject  — anything else (missing fields, invalid phone, bad email,
 *             duplicate-within-upload, phone-collision-with-name-mismatch)
 *
 * No DB. The classifier receives an already-normalized phone + the
 * existing-customer lookup result; the API layer wires those.
 */
import { describe, expect, it } from "vitest";
import { classifyRow, summarize, type DedupCheck } from "@/lib/marketing/csv-classify";
import type { ParsedRow } from "@/lib/marketing/csv";

function row(partial: Partial<ParsedRow> & { row_number: number }): ParsedRow {
  return {
    name: "Ali bin Abu",
    phone: "012-345 6789",
    email: "",
    address: "",
    notes: "",
    manual_tags: [],
    ...partial,
  };
}

function ctx() {
  return { seenPhones: new Set<string>() };
}

describe("classifyRow", () => {
  it("returns `create` on a clean row with no collision", () => {
    const out = classifyRow(
      row({ row_number: 1 }),
      "+60123456789",
      null,
      ctx(),
    );
    expect(out.action).toBe("create");
    if (out.action !== "create") throw new Error();
    expect(out.name).toBe("Ali bin Abu");
    expect(out.phone_e164).toBe("+60123456789");
    expect(out.email).toBeNull();
  });

  it("returns `merge` when phone matches and names normalize-equal", () => {
    const existing: DedupCheck = { id: "cust_1", name: "  ALI bin   ABU " };
    const out = classifyRow(
      row({ row_number: 2 }),
      "+60123456789",
      existing,
      ctx(),
    );
    expect(out.action).toBe("merge");
    if (out.action !== "merge") throw new Error();
    expect(out.existing_customer_id).toBe("cust_1");
  });

  it("returns `reject` when phone matches but names diverge (Q9)", () => {
    const existing: DedupCheck = { id: "cust_2", name: "Siti Sara" };
    const out = classifyRow(
      row({ row_number: 3, name: "Ali bin Abu" }),
      "+60123456789",
      existing,
      ctx(),
    );
    expect(out.action).toBe("reject");
    if (out.action !== "reject") throw new Error();
    expect(out.reason).toMatch(/Siti Sara/);
    expect(out.reason).toMatch(/Fix the CSV/i);
  });

  it("rejects when name is empty", () => {
    const out = classifyRow(
      row({ row_number: 4, name: "" }),
      "+60123456789",
      null,
      ctx(),
    );
    expect(out.action).toBe("reject");
    if (out.action !== "reject") throw new Error();
    expect(out.reason).toMatch(/missing name/i);
  });

  it("rejects when phone is empty", () => {
    const out = classifyRow(
      row({ row_number: 5, phone: "" }),
      null,
      null,
      ctx(),
    );
    expect(out.action).toBe("reject");
    if (out.action !== "reject") throw new Error();
    expect(out.reason).toMatch(/missing phone/i);
  });

  it("rejects when phone failed normalization", () => {
    const out = classifyRow(
      row({ row_number: 6, phone: "not-a-number" }),
      null,
      null,
      ctx(),
    );
    expect(out.action).toBe("reject");
    if (out.action !== "reject") throw new Error();
    expect(out.reason).toMatch(/invalid phone/i);
  });

  it("rejects when email is non-empty but malformed", () => {
    const out = classifyRow(
      row({ row_number: 7, email: "not-an-email" }),
      "+60123456789",
      null,
      ctx(),
    );
    expect(out.action).toBe("reject");
    if (out.action !== "reject") throw new Error();
    expect(out.reason).toMatch(/invalid email/i);
  });

  it("rejects the second occurrence of the same phone within one upload", () => {
    const c = ctx();
    const first = classifyRow(
      row({ row_number: 1 }),
      "+60123456789",
      null,
      c,
    );
    const second = classifyRow(
      row({ row_number: 2, name: "Different person" }),
      "+60123456789",
      null,
      c,
    );
    expect(first.action).toBe("create");
    expect(second.action).toBe("reject");
    if (second.action !== "reject") throw new Error();
    expect(second.reason).toMatch(/duplicate phone/i);
  });

  it("does NOT add a rejected phone to the seenPhones set (so a fresh good row later isn't blocked)", () => {
    const c = ctx();
    // Bad row first
    classifyRow(row({ row_number: 1, name: "" }), "+60111111111", null, c);
    // Same phone again, valid this time — should NOT be a duplicate
    const out = classifyRow(
      row({ row_number: 2, name: "Valid" }),
      "+60111111111",
      null,
      c,
    );
    expect(out.action).toBe("create");
  });

  it("accepts an empty email cell (optional)", () => {
    const out = classifyRow(
      row({ row_number: 8, email: "" }),
      "+60123456789",
      null,
      ctx(),
    );
    expect(out.action).toBe("create");
  });

  it("normalizes name whitespace before comparing", () => {
    // The classifier compares via `normalizeName` which lowercases,
    // trims, and collapses whitespace.
    const existing: DedupCheck = { id: "cust_3", name: "ali  bin  abu" };
    const out = classifyRow(
      row({ row_number: 9, name: "  ALI BIN ABU  " }),
      "+60123456789",
      existing,
      ctx(),
    );
    expect(out.action).toBe("merge");
  });
});

describe("summarize", () => {
  it("counts create / merge / reject correctly", () => {
    const out = summarize([
      { action: "create" } as never,
      { action: "create" } as never,
      { action: "merge" } as never,
      { action: "reject" } as never,
      { action: "reject" } as never,
      { action: "reject" } as never,
    ]);
    expect(out).toEqual({ total: 6, created: 2, merged: 1, rejected: 3 });
  });
});
