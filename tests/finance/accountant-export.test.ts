import { describe, expect, it } from "vitest";
import { financeMonthBounds } from "@/lib/finance/accountant-export";

describe("financeMonthBounds", () => {
  it("returns inclusive start and end for a normal month", () => {
    expect(financeMonthBounds("2026-01")).toEqual({
      start: "2026-01-01",
      end: "2026-01-31",
    });
  });

  it("handles February in a leap year", () => {
    expect(financeMonthBounds("2024-02")).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
    });
  });

  it("throws on invalid month", () => {
    expect(() => financeMonthBounds("bad")).toThrow("Use month=YYYY-MM.");
  });
});
