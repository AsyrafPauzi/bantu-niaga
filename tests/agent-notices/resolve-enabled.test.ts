import { describe, expect, it } from "vitest";
import {
  isDailyNoticeEnabled,
  resolveDailyNoticeAgents,
} from "@/lib/agent-notices/resolve-enabled";
import { TENANT_AI_AGENTS } from "@/lib/settings/ai-agents-catalog";

describe("isDailyNoticeEnabled", () => {
  it("returns false when addon is inactive", () => {
    expect(isDailyNoticeEnabled(false, true, true)).toBe(false);
    expect(isDailyNoticeEnabled(false, true, undefined)).toBe(false);
  });

  it("defaults to true when subscribed and unset", () => {
    expect(isDailyNoticeEnabled(true, true, undefined)).toBe(true);
    expect(isDailyNoticeEnabled(true, true, null)).toBe(true);
  });

  it("respects explicit off", () => {
    expect(isDailyNoticeEnabled(true, true, false)).toBe(false);
  });
});

describe("resolveDailyNoticeAgents", () => {
  it("includes subscribed agents with daily notice on by default", () => {
    const active = new Set(["marketing-assistant", "finance-assistant"]);
    const resolved = resolveDailyNoticeAgents(TENANT_AI_AGENTS, active, new Map());

    expect(resolved.map((a) => a.agentSlug)).toEqual(
      expect.arrayContaining(["marketing", "finance"]),
    );
    expect(resolved.find((a) => a.agentSlug === "marketing")?.displayName).toBe(
      "Maya",
    );
  });

  it("skips agents with daily notice explicitly disabled", () => {
    const active = new Set(["marketing-assistant"]);
    const settings = new Map([
      [
        "marketing",
        { display_name: "Maya Custom", daily_notice_enabled: false },
      ],
    ]);

    const resolved = resolveDailyNoticeAgents(
      TENANT_AI_AGENTS,
      active,
      settings,
    );

    expect(resolved.some((a) => a.agentSlug === "marketing")).toBe(false);
  });

  it("never includes boardroom", () => {
    const active = new Set(["boardroom-weekly"]);
    const resolved = resolveDailyNoticeAgents(TENANT_AI_AGENTS, active, new Map());
    expect(resolved.some((a) => a.agentSlug === "boardroom")).toBe(false);
  });
});
