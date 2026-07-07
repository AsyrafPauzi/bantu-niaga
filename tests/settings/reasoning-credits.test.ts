import { describe, expect, it } from "vitest";
import {
  actionCreditsForReasoning,
  actionTopUpCreditsForReasoning,
  chatCreditsForReasoning,
} from "@/lib/settings/reasoning-credits";

describe("reasoning credit costs", () => {
  it("charges 1 credit per fast chat", () => {
    expect(chatCreditsForReasoning("fast")).toBe(1);
    expect(actionCreditsForReasoning("fast")).toBe(2);
    expect(actionTopUpCreditsForReasoning("fast")).toBe(1);
  });

  it("charges 2 credits per deep chat", () => {
    expect(chatCreditsForReasoning("deep")).toBe(2);
    expect(actionCreditsForReasoning("deep")).toBe(4);
    expect(actionTopUpCreditsForReasoning("deep")).toBe(2);
  });
});
