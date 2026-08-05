import { describe, expect, it } from "vitest";
import { BOARDROOM_MIN_AGENTS } from "@/lib/ai/boardroom-shared";
import {
  isBoardroomCreateConfirm,
  mapPriorityActionsToPending,
} from "@/lib/ai/boardroom-actions";
import { buildCombinedClarifier, ensureBoardroomSpeakers } from "@/lib/ai/boardroom-orchestrator";
import { isBoardroomInvitable } from "@/lib/ai/boardroom-access";
import {
  DEPTH_CHECKPOINT_CREDITS,
  parseAgentStructuredOutput,
  parseAgentStructuredFromText,
  parseChairRecommendation,
} from "@/lib/ai/boardroom-output-schema";
import {
  chairMarkdownLineCount,
  formatAgentNoteForChain,
  renderAgentStructuredToMarkdown,
  renderChairRecommendationToMarkdown,
  renderPlainAgentFallback,
  stripEmbeddedJsonBlob,
} from "@/lib/ai/boardroom-render";

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

describe("boardroom inviteable agents", () => {
  it("allows all module staff", () => {
    expect(isBoardroomInvitable("marketing")).toBe(true);
    expect(isBoardroomInvitable("hr")).toBe(true);
    expect(isBoardroomInvitable("sales")).toBe(true);
    expect(isBoardroomInvitable("finance")).toBe(true);
    expect(isBoardroomInvitable("operations")).toBe(true);
    expect(isBoardroomInvitable("admin")).toBe(true);
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

describe("agent structured output", () => {
  const sample = {
    headline: "RM 8.4k cash gap this month",
    numbers: [
      { label: "Overdue invoices", value: "RM 8,400" },
      { label: "Cash on hand", value: "RM 12,100" },
    ],
    problem: "More out than in; two invoices 30+ days overdue.",
    actions: ["Chase INV-2026-0042", "Bill unbilled job"],
    ask_owner: "Approve payment reminder tone?",
  };

  it("parses valid agent JSON", () => {
    const parsed = parseAgentStructuredOutput(sample);
    expect(parsed?.headline).toContain("cash gap");
    expect(parsed?.numbers).toHaveLength(2);
  });

  it("renders markdown with table and sections", () => {
    const md = renderAgentStructuredToMarkdown(sample);
    expect(md).toContain("**RM 8.4k cash gap");
    expect(md).toContain("| Metric | Amount |");
    expect(md).toContain("**Problem:**");
    expect(md).toContain("**Do next:**");
    expect(md).not.toContain("Staff Contributions");
  });

  it("recovers agent JSON with empty number rows", () => {
    const parsed = parseAgentStructuredFromText(`{
"headline": "Cash gap",
"numbers": [{"label": "", "value": "RM 0"}, {"label": "Overdue", "value": "RM 8k"}],
"problem": "Invoices overdue.",
"actions": ["Chase INV-2026-0042"]
}`);
    expect(parsed?.numbers).toHaveLength(1);
    expect(parsed?.numbers[0]?.label).toBe("Overdue");
  });

  it("recovers truncated agent JSON from text", () => {
    const truncated = `{
"headline": "Promo vs collection",
"numbers": [{"label": "MTD Income", "value": "RM 0.00"}],
"problem": "Zero income this month.",
"actions": ["Send INV-2026-0003 immediately"`;
    const parsed = parseAgentStructuredFromText(truncated);
    expect(parsed?.headline).toContain("Promo");
    const md = renderPlainAgentFallback(truncated);
    expect(md).toContain("**Promo");
    expect(md).not.toContain('"headline"');
  });

  it("renders peer response and skips empty numbers table", () => {
    const md = renderAgentStructuredToMarkdown({
      peer_response:
        "I agree with Fayza — chase cash first, but ORD-2026-0001 must ship today.",
      headline: "Fulfil overdue order before promo",
      numbers: [],
      problem: "Ops delay blocks customer payment.",
      actions: ["Prioritise ORD-2026-0001 today"],
    });
    expect(md).toContain("*I agree with Fayza");
    expect(md).not.toContain("| Metric |");
    expect(md).toContain("**Fulfil overdue");
  });

  it("formats chain notes for the next agent", () => {
    const note = formatAgentNoteForChain(
      {
        agentId: "finance",
        content: "",
        structured: {
          headline: "Close cash gap",
          numbers: [],
          problem: "Zero income",
          actions: ["Send INV-2026-0003"],
        },
      },
      { finance: "Sarah" },
    );
    expect(note).toContain("Sarah:");
    expect(note).toContain("Close cash gap");
    expect(note).toContain("Send INV-2026-0003");
  });

  it("falls back to catalog label without tenant names", () => {
    const note = formatAgentNoteForChain({
      agentId: "finance",
      content: "",
      structured: {
        headline: "Close cash gap",
        numbers: [],
        problem: "Zero income",
        actions: ["Send INV-2026-0003"],
      },
    });
    expect(note).toContain("Fayza:");
  });

  it("strips trailing JSON blobs from model text", () => {
    const raw =
      '**Headline**\n\n{"headline":"x","problem":"y","actions":["z"]}';
    expect(stripEmbeddedJsonBlob(raw)).toBe("**Headline**");
  });
});

describe("chair recommendation", () => {
  const rec = {
    verdict: "Focus cash first — chase overdue before promo.",
    priority_actions: [
      {
        id: "chase-inv",
        label: "Chase INV-2026-0042",
        owner_agent: "finance" as const,
        rationale: "RM 8.4k overdue blocks cash flow",
        link_href: "/finance/invoices",
      },
    ],
  };

  it("parses chair JSON", () => {
    expect(parseChairRecommendation(rec)?.verdict).toContain("cash");
  });

  it("renders without staff summary duplication", () => {
    const md = renderChairRecommendationToMarkdown(rec, { finance: "Sarah" });
    expect(md).toContain("**Focus cash first");
    expect(md).toContain("Chase INV-2026-0042");
    expect(md).toContain("(Sarah)");
    expect(md).not.toContain("Staff Contributions");
    expect(chairMarkdownLineCount(rec)).toBeLessThanOrEqual(8);
  });

  it("maps priority actions to pending", () => {
    const pending = mapPriorityActionsToPending(rec.priority_actions);
    expect(pending[0]?.link_href).toBe("/finance/invoices");
    expect(pending[0]?.id).toBe("chase-inv");
  });
});

describe("ensureBoardroomSpeakers", () => {
  it("promotes finance and first other agent on revenue questions without sales", () => {
    const out = ensureBoardroomSpeakers(
      [
        { agentId: "finance", stance: "silent" },
        { agentId: "operations", stance: "silent" },
      ],
      ["finance", "operations"],
      "How we can make sale 5000 this month?",
    );
    expect(out.find((d) => d.agentId === "finance")?.stance).toBe("speak");
    expect(out.find((d) => d.agentId === "operations")?.stance).toBe("speak");
  });

  it("promotes sales and finance when sales is invited", () => {
    const out = ensureBoardroomSpeakers(
      [
        { agentId: "finance", stance: "silent" },
        { agentId: "sales", stance: "silent" },
        { agentId: "operations", stance: "silent" },
      ],
      ["finance", "sales", "operations"],
      "Hit RM5000 revenue this month",
    );
    expect(out.find((d) => d.agentId === "sales")?.stance).toBe("speak");
    expect(out.find((d) => d.agentId === "finance")?.stance).toBe("speak");
    expect(out.find((d) => d.agentId === "operations")?.stance).toBe("silent");
  });

  it("leaves existing speak decisions unchanged", () => {
    const decisions = [
      { agentId: "finance" as const, stance: "speak" as const },
      { agentId: "operations" as const, stance: "silent" as const },
    ];
    expect(
      ensureBoardroomSpeakers(
        decisions,
        ["finance", "operations"],
        "How we can make sale 5000 this month?",
      ),
    ).toEqual(decisions);
  });
});

describe("depth checkpoint credits", () => {
  it("uses a 10-credit segment before checkpoint", () => {
    expect(DEPTH_CHECKPOINT_CREDITS).toBe(10);
  });
});
