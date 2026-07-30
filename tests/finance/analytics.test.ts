import { describe, expect, it } from "vitest";
import {
  analyticsDateRange,
  parseAnalyticsDays,
  parseReportDateRange,
  parseYmdDate,
} from "@/lib/finance/analytics";

describe("parseAnalyticsDays", () => {
  it("accepts valid presets", () => {
    expect(parseAnalyticsDays("1")).toBe(1);
    expect(parseAnalyticsDays("2")).toBe(2);
    expect(parseAnalyticsDays("3")).toBe(3);
    expect(parseAnalyticsDays("5")).toBe(5);
    expect(parseAnalyticsDays("7")).toBe(7);
    expect(parseAnalyticsDays("14")).toBe(14);
    expect(parseAnalyticsDays("30")).toBe(30);
  });

  it("defaults to 7 for invalid values", () => {
    expect(parseAnalyticsDays("4")).toBe(7);
    expect(parseAnalyticsDays(undefined)).toBe(7);
  });
});

describe("parseYmdDate", () => {
  it("accepts valid dates", () => {
    expect(parseYmdDate("2026-07-31")).toBe("2026-07-31");
  });

  it("rejects invalid dates", () => {
    expect(parseYmdDate("2026-13-01")).toBeNull();
    expect(parseYmdDate("2026-07-31-01")).toBeNull();
  });
});

describe("parseReportDateRange", () => {
  it("uses custom from/to when valid", () => {
    const range = parseReportDateRange({
      from: "2026-07-01",
      to: "2026-07-15",
    });
    expect(range.mode).toBe("custom");
    expect(range.start).toBe("2026-07-01");
    expect(range.end).toBe("2026-07-15");
    expect(range.days).toBeNull();
  });

  it("falls back to preset when from > to", () => {
    const range = parseReportDateRange({
      from: "2026-07-20",
      to: "2026-07-01",
      days: "14",
    });
    expect(range.mode).toBe("preset");
    expect(range.days).toBe(14);
  });
});

describe("analyticsDateRange", () => {
  it("spans the requested number of inclusive days", () => {
    for (const days of [1, 2, 3, 5, 7, 14, 30] as const) {
      const { start, end } = analyticsDateRange(days);
      const startMs = new Date(`${start}T12:00:00`).getTime();
      const endMs = new Date(`${end}T12:00:00`).getTime();
      const span = Math.round((endMs - startMs) / 86_400_000) + 1;
      expect(span).toBe(days);
    }
  });
});
