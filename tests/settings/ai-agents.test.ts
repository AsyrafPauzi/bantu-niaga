import { describe, expect, it } from "vitest";
import { agentSettingsUpdateSchema } from "@/lib/settings/agent-settings-schemas";
import {
  modelForReasoningMode,
  normalizeReasoningMode,
} from "@/lib/settings/ai-agents-catalog";

describe("agentSettingsUpdateSchema", () => {
  it("accepts reasoning mode and daily budget credits", () => {
    const parsed = agentSettingsUpdateSchema.parse({
      reasoning_mode: "deep",
      daily_budget_credits: 50,
    });
    expect(parsed.reasoning_mode).toBe("deep");
    expect(parsed.daily_budget_credits).toBe(50);
  });

  it("rejects auto reasoning mode", () => {
    expect(() =>
      agentSettingsUpdateSchema.parse({ reasoning_mode: "auto" }),
    ).toThrow();
  });

  it("rejects empty patch", () => {
    expect(() => agentSettingsUpdateSchema.parse({})).toThrow();
  });
});

describe("reasoning mode models", () => {
  it("maps fast to ilmu-mini-v3.3", () => {
    expect(modelForReasoningMode("fast")).toBe("ilmu-mini-v3.3");
  });

  it("maps deep to ilmu-v3.1", () => {
    expect(modelForReasoningMode("deep")).toBe("ilmu-v3.1");
  });

  it("coerces auto to fast", () => {
    expect(normalizeReasoningMode("auto")).toBe("fast");
  });
});
