import { describe, expect, it } from "vitest";
import {
  composeStaffAgentSystemPrompt,
  formatAgentScopePolicy,
} from "@/lib/ai/agent-scope-runtime";
import type { PublishedAgentScope } from "@/lib/ai/agent-scope-runtime";

describe("agent scope runtime", () => {
  const scope: PublishedAgentScope = {
    slug: "finance",
    versionLabel: "v1.1.0",
    systemPrompt: "Use tools before stating RM figures.",
    defaultTone: "Clear",
    allowedActions: [
      { key: "read", label: "Read invoices", on: true },
      { key: "write", label: "Create invoice", on: false },
    ],
    guardrails: [
      {
        label: "No invented numbers",
        detail: "Packet only",
        severity: "always",
      },
    ],
    escalation: [
      { trigger: "Vague ask", target: "Clarify first" },
    ],
    knowledgeBase: [
      { label: "Finance invoices", kind: "Supabase", size: "tenant" },
    ],
  };

  it("formats policy block from scope", () => {
    const policy = formatAgentScopePolicy(scope);
    expect(policy).toContain("PLATFORM ALLOWED ACTIONS");
    expect(policy).toContain("Read invoices");
    expect(policy).toContain("DISABLED UNTIL ENABLED");
    expect(policy).toContain("No invented numbers");
  });

  it("prefers published system prompt over fallback", () => {
    const out = composeStaffAgentSystemPrompt({
      scope,
      fallbackRules: "FALLBACK RULES",
      displayName: "Fayza",
      todayIso: "2026-08-04",
      roleLabel: "Finance",
    });
    expect(out).toContain("Use tools before stating RM figures");
    expect(out).not.toContain("FALLBACK RULES");
    expect(out).toContain("PLATFORM SCOPE");
    expect(out).toContain("You are Fayza, the Finance staff AI");
  });

  it("uses fallback when scope missing", () => {
    const out = composeStaffAgentSystemPrompt({
      scope: null,
      fallbackRules: "FALLBACK RULES",
      displayName: "Fayza",
      todayIso: "2026-08-04",
    });
    expect(out).toContain("FALLBACK RULES");
  });
});
