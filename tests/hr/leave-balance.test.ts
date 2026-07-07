import { describe, expect, it } from "vitest";
import {
  buildOverBalanceWarning,
  countWorkingLeaveDays,
} from "@/lib/hr/leave-balance";

describe("countWorkingLeaveDays", () => {
  const holidays = new Set(["2026-08-31"]);

  it("excludes weekends and public holidays", () => {
    // Mon 31 Aug 2026 is holiday; range Mon-Fri that week minus holiday
    expect(
      countWorkingLeaveDays("2026-08-31", "2026-09-04", holidays),
    ).toBe(4);
  });

  it("returns zero when end is before start", () => {
    expect(countWorkingLeaveDays("2026-09-05", "2026-09-01", holidays)).toBe(0);
  });
});

describe("buildOverBalanceWarning", () => {
  it("warns when approval exceeds entitlement", () => {
    const warning = buildOverBalanceWarning(8, 7, 2);
    expect(warning?.code).toBe("al_over_balance");
    expect(warning?.message).toContain("still approve");
  });

  it("returns null when within balance", () => {
    expect(buildOverBalanceWarning(8, 2, 3)).toBeNull();
  });
});
