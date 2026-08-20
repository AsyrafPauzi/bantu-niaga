import { describe, expect, it } from "vitest";
import {
  buildLeaveDecisionMessages,
  waMeUrl,
} from "@/lib/hr/leave-status-messages";

describe("buildLeaveDecisionMessages", () => {
  it("builds EN and MS without IC numbers", () => {
    const m = buildLeaveDecisionMessages({
      status: "approved",
      employeeName: "Aina",
      leaveTypeLabel: "Annual leave",
      startDate: "2026-08-21",
      endDate: "2026-08-22",
    });
    expect(m.en).toMatch(/Aina/);
    expect(m.en).toMatch(/approved/i);
    expect(m.ms).toMatch(/diluluskan/i);
    expect(m.en + m.ms).not.toMatch(/\d{12}/);
  });
});

describe("waMeUrl", () => {
  it("strips non-digits from phone", () => {
    expect(waMeUrl("+60 12-345 6789", "hi")).toContain("wa.me/60123456789");
  });
});
