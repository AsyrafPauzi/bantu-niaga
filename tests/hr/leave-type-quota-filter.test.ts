import { describe, expect, it } from "vitest";
import { LEAVE_TYPES } from "@/lib/hr/leave-labels";
import { filterLeaveTypesWithQuota } from "@/lib/hr/leave-type-policy";

describe("filterLeaveTypesWithQuota", () => {
  it("hides emergency when quota is not set", () => {
    const filtered = filterLeaveTypesWithQuota(LEAVE_TYPES, {
      annual: 8,
      mc: 14,
      emergency: null,
      hospitalisation: 60,
    });
    expect(filtered.map((t) => t.key)).toEqual([
      "annual",
      "mc",
      "hospitalisation",
      "unpaid",
    ]);
  });

  it("keeps unpaid even without a quota", () => {
    const filtered = filterLeaveTypesWithQuota(LEAVE_TYPES, {
      annual: 8,
      unpaid: null,
    });
    expect(filtered.some((t) => t.key === "unpaid")).toBe(true);
  });
});
