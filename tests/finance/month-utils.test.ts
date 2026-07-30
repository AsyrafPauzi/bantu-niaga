import { describe, expect, it } from "vitest";
import {
  financeMonthBounds,
  parseFinanceMonth,
} from "@/lib/finance/helpers";

describe("parseFinanceMonth", () => {
  it("accepts YYYY-MM", () => {
    expect(parseFinanceMonth("2026-07")).toBe("2026-07");
  });

  it("normalizes YYYY-MM-DD to YYYY-MM", () => {
    expect(parseFinanceMonth("2026-07-31")).toBe("2026-07");
  });

  it("rejects invalid months", () => {
    expect(parseFinanceMonth("2026-13")).toMatch(/^\d{4}-\d{2}$/);
    expect(parseFinanceMonth("2026-13")).not.toBe("2026-13");
  });
});

describe("financeMonthBounds", () => {
  it("returns valid date range for July 2026", () => {
    const { start, end, label } = financeMonthBounds("2026-07");
    expect(label).toBe("2026-07");
    expect(start).toBe("2026-07-01");
    expect(end).toBe("2026-07-31");
  });

  it("handles accidental full-date input", () => {
    const { start, end } = financeMonthBounds("2026-07-31");
    expect(start).toBe("2026-07-01");
    expect(end).toBe("2026-07-31");
    expect(start).not.toContain("2026-07-31-01");
  });
});
