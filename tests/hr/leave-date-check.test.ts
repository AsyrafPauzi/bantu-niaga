import { describe, expect, it } from "vitest";
import { countWorkingLeaveDays } from "@/lib/hr/leave-balance";

describe("leave date analysis helpers", () => {
  it("counts working days excluding weekends and holidays", () => {
    const holidays = new Set(["2026-08-31"]);
    const days = countWorkingLeaveDays("2026-08-28", "2026-09-01", holidays);
    // Fri 28, Mon 31 is holiday, Tue 1 = 2 working days (Fri + Tue) wait:
    // Aug 28 Fri, Aug 29 Sat, Aug 30 Sun, Aug 31 Mon holiday, Sep 1 Tue
    // Working: Fri 28, Tue Sep 1 = 2
    expect(days).toBe(2);
  });
});
