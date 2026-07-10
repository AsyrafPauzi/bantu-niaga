import { describe, expect, it } from "vitest";
import { BOARDROOM_MIN_AGENTS } from "@/lib/ai/boardroom-shared";
import { isBoardroomCreateConfirm } from "@/lib/ai/boardroom-actions";
import { buildCombinedClarifier } from "@/lib/ai/boardroom-orchestrator";
import { isInvitableV1 } from "@/lib/ai/boardroom-access";

describe("boardroom unlock rule", () => {
  it("requires more than one active agent", () => {
    expect(BOARDROOM_MIN_AGENTS).toBe(2);
  });

  it("unlocks at two agents", () => {
    const activeCount = 2;
    expect(activeCount >= BOARDROOM_MIN_AGENTS).toBe(true);
  });

  it("stays locked with only HR assistant", () => {
    const activeCount = 1;
    expect(activeCount >= BOARDROOM_MIN_AGENTS).toBe(false);
  });
});

describe("boardroom inviteable v1", () => {
  it("allows Maya Hana Sufi", () => {
    expect(isInvitableV1("marketing")).toBe(true);
    expect(isInvitableV1("hr")).toBe(true);
    expect(isInvitableV1("sales")).toBe(true);
    expect(isInvitableV1("finance")).toBe(false);
  });
});

describe("boardroom create confirm", () => {
  it("accepts short confirm phrases", () => {
    expect(isBoardroomCreateConfirm("confirm")).toBe(true);
    expect(isBoardroomCreateConfirm("yes")).toBe(true);
    expect(isBoardroomCreateConfirm("ya buat")).toBe(true);
  });

  it("rejects long unrelated messages", () => {
    expect(
      isBoardroomCreateConfirm(
        "please also update the leave policy and rewrite the whole handbook",
      ),
    ).toBe(false);
  });
});

describe("combined clarifier", () => {
  it("lists clarify questions only", () => {
    const text = buildCombinedClarifier(
      [
        {
          agentId: "marketing",
          stance: "clarify",
          clarifyQuestion: "Which segment?",
        },
        { agentId: "hr", stance: "silent" },
        {
          agentId: "sales",
          stance: "clarify",
          clarifyQuestion: "Which lead?",
        },
      ],
      { marketing: "Maya", sales: "Sufi" },
    );
    expect(text).toContain("Maya");
    expect(text).toContain("Which segment?");
    expect(text).toContain("Sufi");
    expect(text).not.toContain("Hana");
  });
});
