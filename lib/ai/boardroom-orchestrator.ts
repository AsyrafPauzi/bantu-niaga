import "server-only";

import type { AgentContext } from "@/lib/ai/context/types";
import { buildBriefing } from "@/lib/ai/context";
import {
  extractChatAssistantText,
  openaiChat,
  type ChatCompletionResponse,
} from "@/lib/ai/openai";
import { boardroomAgentLabel } from "@/lib/ai/boardroom-access";
import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";
import { BOARDROOM_AGENTS } from "@/lib/ai/boardroom-shared";
import {
  extractBoardroomPendingActions,
  type BoardroomPendingAction,
} from "@/lib/ai/boardroom-actions";
import { spendCredits } from "@/lib/ai/credits";
import { resolveAgentModel } from "@/lib/settings/ai-agents-catalog";

export type AgentStance = "silent" | "clarify" | "speak";

export interface AgentDecision {
  agentId: BoardroomAgentId;
  stance: AgentStance;
  clarifyQuestion?: string;
}

export interface BoardroomTurnResult {
  clarifierContent: string | null;
  agentReplies: Array<{ agentId: BoardroomAgentId; content: string }>;
  synthContent: string | null;
  creditsCharged: number;
  awaitingClarifiers: boolean;
  decisions: AgentDecision[];
  pendingActions: BoardroomPendingAction[];
}

function pillarForAgent(id: BoardroomAgentId): "marketing" | "hr" | "sales" | null {
  if (id === "marketing") return "marketing";
  if (id === "hr") return "hr";
  if (id === "sales") return "sales";
  return null;
}

/**
 * Classify each invited agent: silent / clarify / speak.
 * One cheap model call for the whole room.
 */
export async function classifyRoomAgents(opts: {
  ctx: AgentContext;
  invited: BoardroomAgentId[];
  userMessage: string;
  model: string;
}): Promise<AgentDecision[]> {
  const roster = opts.invited
    .map((id) => {
      const meta = BOARDROOM_AGENTS.find((a) => a.id === id);
      return `- ${id} (${meta?.label ?? id}): ${meta?.role ?? ""}`;
    })
    .join("\n");

  try {
    const completion = await openaiChat<ChatCompletionResponse>({
      model: opts.model,
      temperature: 0.1,
      max_tokens: 400,
      includeBriefing: false,
      messages: [
        {
          role: "system",
          content: `You are the Boardroom chair for a Malaysian SME meeting.
For EACH invited agent, decide stance for the owner's message:
- silent — not their domain
- clarify — related but need 1 short clarifying question first
- speak — related and confident enough to give a view/plan

Return ONLY valid JSON:
{"decisions":[{"agentId":"marketing"|"hr"|"sales","stance":"silent"|"clarify"|"speak","clarifyQuestion":"optional string"}]}

Invited agents:
${roster}`,
        },
        { role: "user", content: opts.userMessage },
      ],
    });

    const text = extractChatAssistantText(completion);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no json");
    const parsed = JSON.parse(jsonMatch[0]) as {
      decisions?: Array<{
        agentId: string;
        stance: string;
        clarifyQuestion?: string;
      }>;
    };

    const byId = new Map(
      (parsed.decisions ?? []).map((d) => [d.agentId, d]),
    );

    return opts.invited.map((id) => {
      const d = byId.get(id);
      const stance =
        d?.stance === "clarify" || d?.stance === "speak" || d?.stance === "silent"
          ? d.stance
          : "silent";
      return {
        agentId: id,
        stance,
        clarifyQuestion:
          stance === "clarify"
            ? (d?.clarifyQuestion?.trim() ||
              `What should ${boardroomAgentLabel(id)} focus on for this?`)
            : undefined,
      };
    });
  } catch {
    // Fallback: all invited speak (safe default for meeting usefulness)
    return opts.invited.map((id) => ({
      agentId: id,
      stance: "speak" as const,
    }));
  }
}

export function buildCombinedClarifier(
  decisions: AgentDecision[],
  displayNames: Record<string, string>,
): string {
  const lines = decisions
    .filter((d) => d.stance === "clarify")
    .map((d, i) => {
      const name = displayNames[d.agentId] || boardroomAgentLabel(d.agentId);
      return `${i + 1}. **${name}:** ${d.clarifyQuestion}`;
    });

  return [
    "Before we continue, the room has a few quick questions (free — no credits):",
    "",
    ...lines,
    "",
    "Reply in one message — or say **you decide**.",
  ].join("\n");
}

async function runAgentSpeak(opts: {
  ctx: AgentContext;
  agentId: BoardroomAgentId;
  userMessage: string;
  priorNotes: string;
  model: string;
  displayName: string;
}): Promise<string> {
  const pillar = pillarForAgent(opts.agentId);
  const briefing = pillar
    ? await buildBriefing(pillar, opts.ctx)
    : { text: "No pillar data.", available: false };

  const meta = BOARDROOM_AGENTS.find((a) => a.id === opts.agentId);
  const completion = await openaiChat<ChatCompletionResponse>({
    model: opts.model,
    temperature: 0.3,
    max_tokens: 500,
    includeBriefing: false,
    messages: [
      {
        role: "system",
        content: `You are ${opts.displayName} (${meta?.role ?? "AI"}), a staff member in the SME Boardroom meeting.
Speak only from YOUR data packet. Be practical, short, Bahasa Malaysia or English matching the owner.
Do NOT invent figures. If data is thin, say what is missing.
Do NOT create records unless the owner clearly asked to create and you are proposing a draft for approval.
Prior colleagues in this turn:
${opts.priorNotes || "(you speak first)"}

DATA PACKET:
${briefing.text}`,
      },
      { role: "user", content: opts.userMessage },
    ],
  });

  return extractChatAssistantText(completion);
}

async function runSynthesis(opts: {
  userMessage: string;
  agentReplies: Array<{ agentId: BoardroomAgentId; content: string }>;
  model: string;
}): Promise<string> {
  const body = opts.agentReplies
    .map((r) => `### ${boardroomAgentLabel(r.agentId)}\n${r.content}`)
    .join("\n\n");

  const completion = await openaiChat<ChatCompletionResponse>({
    model: opts.model,
    temperature: 0.2,
    max_tokens: 350,
    includeBriefing: false,
    messages: [
      {
        role: "system",
        content: `You are the Boardroom chair. Synthesize the staff views into ONE clear recommendation for a Malaysian SME owner.
Use bullets. No invented numbers. Mention who said what briefly. End with one next step.
If the owner asked to create something, list what can be drafted (Maya coupon/broadcast/content, Sufi lead note) and ask them to confirm before creating.`,
      },
      {
        role: "user",
        content: `Owner question:\n${opts.userMessage}\n\nStaff views:\n${body}`,
      },
    ],
  });

  return extractChatAssistantText(completion);
}

/**
 * Full boardroom turn after clarifiers are resolved (or not needed).
 */
export async function runBoardroomSpeakTurn(opts: {
  ctx: AgentContext;
  invited: BoardroomAgentId[];
  userMessage: string;
  decisions: AgentDecision[];
  displayNames: Record<string, string>;
  model?: string;
}): Promise<BoardroomTurnResult> {
  const model =
    opts.model ??
    resolveAgentModel({ reasoningMode: "fast", modelOverride: null });

  const speakers = opts.decisions.filter((d) => d.stance === "speak");
  const agentReplies: Array<{ agentId: BoardroomAgentId; content: string }> =
    [];
  let creditsCharged = 0;
  let priorNotes = "";

  for (const d of speakers) {
    const content = await runAgentSpeak({
      ctx: opts.ctx,
      agentId: d.agentId,
      userMessage: opts.userMessage,
      priorNotes,
      model,
      displayName: opts.displayNames[d.agentId] || boardroomAgentLabel(d.agentId),
    });
    agentReplies.push({ agentId: d.agentId, content });
    priorNotes += `\n${boardroomAgentLabel(d.agentId)}: ${content.slice(0, 280)}`;

    try {
      const spend = await spendCredits(opts.ctx, {
        amount: 1,
        reason: `boardroom.agent.${d.agentId}`,
      });
      creditsCharged += spend.charged;
    } catch {
      // Continue meeting even if credit shortfall mid-turn; UI shows balance.
    }
  }

  let synthContent: string | null = null;
  if (agentReplies.length > 0) {
    synthContent = await runSynthesis({
      userMessage: opts.userMessage,
      agentReplies,
      model,
    });
  } else {
    synthContent =
      "No one in the room had enough context to speak on this. Try inviting another agent or rephrasing the question.";
  }

  const pendingActions =
    synthContent && agentReplies.length > 0
      ? await extractBoardroomPendingActions({
          invited: opts.invited,
          userMessage: opts.userMessage,
          synthContent,
          agentReplies,
          model,
        })
      : [];

  if (pendingActions.length > 0 && synthContent) {
    synthContent = `${synthContent}\n\n---\nReady to create: ${pendingActions
      .map((a) => a.summary)
      .join("; ")}.\nReply **confirm** to create these drafts (Hana stays advise-only).`;
  }

  return {
    clarifierContent: null,
    agentReplies,
    synthContent,
    creditsCharged,
    awaitingClarifiers: false,
    decisions: opts.decisions,
    pendingActions,
  };
}

export async function runBoardroomUserTurn(opts: {
  ctx: AgentContext;
  invited: BoardroomAgentId[];
  userMessage: string;
  answeringClarifiers: boolean;
  priorDecisions?: AgentDecision[];
  displayNames: Record<string, string>;
}): Promise<BoardroomTurnResult> {
  const model = resolveAgentModel({
    reasoningMode: "fast",
    modelOverride: null,
  });

  let decisions = opts.priorDecisions;
  if (!opts.answeringClarifiers || !decisions) {
    decisions = await classifyRoomAgents({
      ctx: opts.ctx,
      invited: opts.invited,
      userMessage: opts.userMessage,
      model,
    });
  }

  const needClarify =
    !opts.answeringClarifiers &&
    decisions.some((d) => d.stance === "clarify");

  if (needClarify) {
    // Promote clarify → will speak after answer; keep clarify questions for card
    return {
      clarifierContent: buildCombinedClarifier(decisions, opts.displayNames),
      agentReplies: [],
      synthContent: null,
      creditsCharged: 0,
      awaitingClarifiers: true,
      decisions,
      pendingActions: [],
    };
  }

  // After clarifiers (or none needed): anyone who was clarify now speaks
  const speakDecisions = decisions.map((d) =>
    d.stance === "clarify" ? { ...d, stance: "speak" as const } : d,
  );

  return runBoardroomSpeakTurn({
    ctx: opts.ctx,
    invited: opts.invited,
    userMessage: opts.userMessage,
    decisions: speakDecisions,
    displayNames: opts.displayNames,
    model,
  });
}
