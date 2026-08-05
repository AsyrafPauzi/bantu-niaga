import { describe, expect, it } from "vitest";
import {
  buildOperationsOutOfScopeReply,
  detectOperationsAssistantOutOfScope,
} from "@/lib/ai/assistant-pillar-guard";

describe("assistant-pillar-guard", () => {
  it("allows operations topics", () => {
    expect(
      detectOperationsAssistantOutOfScope("Which products are low stock?"),
    ).toBeNull();
    expect(
      detectOperationsAssistantOutOfScope("Create booking for Ali tomorrow"),
    ).toBeNull();
    expect(
      detectOperationsAssistantOutOfScope("List overdue orders"),
    ).toBeNull();
    expect(
      detectOperationsAssistantOutOfScope("Supplier phone for restock"),
    ).toBeNull();
  });

  it("redirects finance topics", () => {
    const redirect = detectOperationsAssistantOutOfScope(
      "Chase unpaid invoices this week",
    );
    expect(redirect?.agentName).toBe("Fayza");
    expect(redirect?.chatHref).toBe("/finance?fayza=open");
  });

  it("redirects HR topics", () => {
    const redirect = detectOperationsAssistantOutOfScope(
      "Who is on leave tomorrow?",
    );
    expect(redirect?.agentName).toBe("Hana");
  });

  it("redirects marketing topics", () => {
    const redirect = detectOperationsAssistantOutOfScope(
      "Draft a WhatsApp broadcast for VIP customers",
    );
    expect(redirect?.agentName).toBe("Maya");
  });

  it("builds a helpful redirect reply", () => {
    const reply = buildOperationsOutOfScopeReply("Aiman", {
      pillar: "Finance",
      agentName: "Fayza",
      chatHref: "/finance?fayza=open",
    });
    expect(reply).toContain("Aiman");
    expect(reply).toContain("Fayza");
    expect(reply).toContain("/finance?fayza=open");
  });
});
