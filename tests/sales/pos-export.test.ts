import { describe, expect, it } from "vitest";
import {
  parseSalesExportPeriod,
} from "@/lib/sales/pos-export";
import { parseSalesHistoryPeriod } from "@/lib/sales/history";

describe("parseSalesExportPeriod", () => {
  it("defaults to today", () => {
    expect(parseSalesExportPeriod()).toBe("today");
    expect(parseSalesExportPeriod("invalid")).toBe("today");
  });

  it("accepts week and month", () => {
    expect(parseSalesExportPeriod("week")).toBe("week");
    expect(parseSalesExportPeriod("month")).toBe("month");
  });
});

describe("parseSalesHistoryPeriod", () => {
  it("mirrors export period parsing", () => {
    expect(parseSalesHistoryPeriod("week")).toBe("week");
    expect(parseSalesHistoryPeriod(null)).toBe("today");
  });
});
