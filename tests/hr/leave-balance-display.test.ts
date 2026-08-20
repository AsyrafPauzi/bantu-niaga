import { describe, expect, it } from "vitest";
import {
  buildLeaveBalanceLines,
  countApprovedLeaveDaysByType,
  inclusiveCalendarDays,
} from "@/lib/hr/leave-balance-display";

describe("inclusiveCalendarDays", () => {
  it("counts inclusive range", () => {
    expect(inclusiveCalendarDays("2026-08-21", "2026-08-22")).toBe(2);
    expect(inclusiveCalendarDays("2026-08-21", "2026-08-21")).toBe(1);
  });
});

describe("buildLeaveBalanceLines", () => {
  it("shows AL remaining and MC used vs cap", () => {
    const lines = buildLeaveBalanceLines({
      annual: { entitlement: 8, taken: 3 },
      caps: { mc: 14 },
      usedByType: { mc: 2 },
    });
    const al = lines.find((l) => l.key === "annual");
    const mc = lines.find((l) => l.key === "mc");
    expect(al).toMatchObject({ used: 3, entitlement: 8, remaining: 5 });
    expect(mc).toMatchObject({ used: 2, entitlement: 14, remaining: 12 });
  });

  it("marks missing caps as not configured", () => {
    const lines = buildLeaveBalanceLines({
      annual: { entitlement: 8, taken: 0 },
      caps: {},
      usedByType: {},
    });
    expect(lines.find((l) => l.key === "mc")).toMatchObject({
      entitlement: null,
      used: null,
      remaining: null,
    });
  });
});

describe("countApprovedLeaveDaysByType", () => {
  it("sums approved MC days in year", () => {
    const used = countApprovedLeaveDaysByType(
      [
        {
          leave_type: "mc",
          start_date: "2026-03-01",
          end_date: "2026-03-02",
          status: "approved",
        },
        {
          leave_type: "mc",
          start_date: "2025-12-01",
          end_date: "2025-12-03",
          status: "approved",
        },
        {
          leave_type: "mc",
          start_date: "2026-04-01",
          end_date: "2026-04-01",
          status: "pending",
        },
      ],
      2026,
    );
    expect(used.mc).toBe(2);
  });
});
