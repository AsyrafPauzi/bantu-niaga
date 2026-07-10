import { describe, expect, it } from "vitest";
import {
  buildHrAssistantRules,
  HR_ASSISTANT_SUGGESTIONS,
} from "@/lib/ai/hr-assistant-prompt";

describe("Hana staff planning prompt", () => {
  it("instructs clarify-then-plan staff behaviour", () => {
    const rules = buildHrAssistantRules({
      displayName: "Hana",
      businessName: "Kedai Demo",
      todayIso: "2026-07-11",
    });
    expect(rules).toContain("STAFF PLANNING FLOW");
    expect(rules).toContain("clarifying questions FIRST");
    expect(rules).toContain("DIRECT ACTIONS");
    expect(rules).toContain("Kedai Demo");
  });

  it("offers a monthly HR help suggestion chip", () => {
    expect(
      HR_ASSISTANT_SUGGESTIONS.some((s) => /HR this month/i.test(s)),
    ).toBe(true);
  });
});
