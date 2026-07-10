import { describe, expect, it } from "vitest";
import {
  buildFreeClarifierReply,
  isClarifyingOnlyReply,
  isPlanningIntent,
  shouldChargeAssistantTurn,
  shouldUseFreeClarifierTemplate,
} from "@/lib/ai/assistant-clarifier";

describe("assistant clarifier billing", () => {
  it("detects marketing planning intent", () => {
    expect(isPlanningIntent("marketing", "Help me boost sales this month")).toBe(
      true,
    );
    expect(isPlanningIntent("marketing", "Who are my VIP customers?")).toBe(
      false,
    );
  });

  it("offers free clarifier on first planning turn only", () => {
    expect(
      shouldUseFreeClarifierTemplate("hr", "Help me with HR this month", []),
    ).toBe(true);

    const afterAsk = [
      {
        role: "assistant",
        content: buildFreeClarifierReply("hr", "Hana", "Help me with HR this month"),
      },
    ];
    expect(
      shouldUseFreeClarifierTemplate(
        "hr",
        "Clear pending leave this week for everyone",
        afterAsk,
      ),
    ).toBe(false);
  });

  it("does not charge clarifying-only replies", () => {
    const clarifier = buildFreeClarifierReply(
      "marketing",
      "Maya",
      "boost sales",
    );
    expect(isClarifyingOnlyReply(clarifier)).toBe(true);
    expect(
      shouldChargeAssistantTurn({ usedActionTool: false, reply: clarifier }),
    ).toBe(false);
  });

  it("charges plans and actions", () => {
    expect(
      shouldChargeAssistantTurn({
        usedActionTool: true,
        reply: "Before I plan, a few quick questions?\n1. Goal?\n2. Discount?",
      }),
    ).toBe(true);
    expect(
      shouldChargeAssistantTurn({
        usedActionTool: false,
        reply:
          "Here's my plan for July:\n- Push slow movers\n- WhatsApp dormant\nI can create the coupon when you say yes.",
      }),
    ).toBe(true);
  });
});
