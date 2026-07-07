import { describe, expect, it } from "vitest";
import { resolveAgentModel } from "@/lib/settings/ai-agents-catalog";

describe("resolveAgentModel", () => {
  it("uses admin override when set", () => {
    expect(
      resolveAgentModel({
        reasoningMode: "fast",
        modelOverride: "gpt-4o",
      }),
    ).toBe("gpt-4o");
  });

  it("falls back to reasoning mode mapping", () => {
    expect(
      resolveAgentModel({
        reasoningMode: "deep",
        modelOverride: null,
      }),
    ).toBe("ilmu-v3.1");
  });
});
