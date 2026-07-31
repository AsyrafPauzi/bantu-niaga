import { describe, expect, it } from "vitest";
import {
  buildMarketingAssistantRules,
  MARKETING_ASSISTANT_SUGGESTIONS,
} from "@/lib/ai/marketing-assistant-prompt";

describe("Maya staff planning prompt", () => {
  it("instructs clarify-then-plan staff behaviour", () => {
    const rules = buildMarketingAssistantRules({
      displayName: "Maya",
      businessName: "Kedai Demo",
      todayIso: "2026-07-11",
    });
    expect(rules).toContain("STAFF PLANNING FLOW");
    expect(rules).toContain("clarifying questions FIRST");
    expect(rules).toContain("ASK BEFORE YOU ACT");
    expect(rules).toContain("under 120 words");
    expect(rules).toContain("COMMERCE");
    expect(rules).toContain("Max discount");
    expect(rules).toContain("Kedai Demo");
  });

  it("offers module-aware suggestion chips", () => {
    expect(MARKETING_ASSISTANT_SUGGESTIONS.some((s) => /boost sales/i.test(s)))
      .toBe(true);
    expect(MARKETING_ASSISTANT_SUGGESTIONS.some((s) => /segment/i.test(s)))
      .toBe(true);
    expect(MARKETING_ASSISTANT_SUGGESTIONS.some((s) => /content calendar/i.test(s)))
      .toBe(true);
  });
});
