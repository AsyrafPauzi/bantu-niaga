import { describe, expect, it } from "vitest";
import { buildMarketingDailyNotice } from "@/lib/ai/marketing-daily-notice";
import type { PillarSnapshot } from "@/lib/ai/context/types";

const baseSnapshot: PillarSnapshot = {
  pillar: "marketing",
  businessId: "biz-1",
  generatedAt: new Date().toISOString(),
  available: true,
  headline: "Marketing snapshot",
  kpis: [],
  recent: [],
  attention: [
    {
      id: "dormant_pile",
      label: "5 customer(s) haven't purchased in 7+ days",
      severity: "medium",
    },
  ],
};

describe("buildMarketingDailyNotice", () => {
  it("includes Maya display name and attention items", () => {
    const notice = buildMarketingDailyNotice(baseSnapshot, "Maya");
    expect(notice.title).toContain("Maya");
    expect(notice.body).toContain("haven't purchased");
  });

  it("falls back when no attention items", () => {
    const notice = buildMarketingDailyNotice(
      { ...baseSnapshot, attention: [] },
      "Maya",
    );
    expect(notice.body).toContain("No urgent Marketing items");
  });
});
