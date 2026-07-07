import { describe, expect, it } from "vitest";
import { buildHrDailyNotice } from "@/lib/ai/hr-daily-notice";
import type { PillarSnapshot } from "@/lib/ai/context/types";

const baseSnapshot: PillarSnapshot = {
  pillar: "hr",
  businessId: "biz-1",
  generatedAt: new Date().toISOString(),
  available: true,
  headline: "HR snapshot",
  kpis: [],
  recent: [],
  attention: [
    { id: "a1", label: "1 leave waiting for approval", severity: "high" },
  ],
  notes: "Next holiday: Merdeka on 2026-08-31.",
};

describe("buildHrDailyNotice", () => {
  it("includes attention items in body", () => {
    const notice = buildHrDailyNotice(baseSnapshot, "Hana");
    expect(notice.title).toContain("Hana");
    expect(notice.body).toContain("1 leave waiting for approval");
    expect(notice.body).toContain("Merdeka");
  });

  it("omits holiday notes when snapshot has no holiday data", () => {
    const notice = buildHrDailyNotice(
      { ...baseSnapshot, notes: "2 staff on approved leave today." },
      "Hana",
    );
    expect(notice.body).not.toContain("Merdeka");
    expect(notice.body).toContain("2 staff on approved leave");
  });

  it("handles empty HR data", () => {
    const notice = buildHrDailyNotice(
      { ...baseSnapshot, available: false, attention: [] },
      "Siti",
    );
    expect(notice.body).toContain("No HR records yet");
  });
});
