import "server-only";

import type { AgentContext } from "@/lib/ai/context/types";
import { buildBriefing } from "@/lib/ai/context";
import {
  extractChatAssistantText,
  openaiChat,
  type ChatCompletionResponse,
} from "@/lib/ai/openai";
import {
  boardroomAgentLabel,
  resolveBoardroomDisplayName,
} from "@/lib/ai/boardroom-access";
import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";
import { BOARDROOM_AGENTS } from "@/lib/ai/boardroom-shared";
import {
  buildAgentBoardroomSystemPrompt,
  buildChairSynthesisSystemPrompt,
  buildColleagueRoster,
  buildConfidenceEvaluationPrompt,
} from "@/lib/ai/boardroom-agent-prompts";
import {
  type AgentStructuredOutput,
  type ChairRecommendation,
  type ConfidenceEvaluation,
  type DepthState,
  type MeetingMode,
  DEPTH_CHECKPOINT_CREDITS,
  DEPTH_CONFIDENCE_THRESHOLD,
  extractJsonObject,
  parseAgentStructuredOutput,
  parseAgentStructuredFromText,
  parseChairRecommendation,
  parseConfidenceEvaluation,
  slugActionId,
} from "@/lib/ai/boardroom-output-schema";
import {
  renderAgentStructuredToMarkdown,
  renderChairRecommendationToMarkdown,
  renderPlainAgentFallback,
  formatAgentNoteForChain,
} from "@/lib/ai/boardroom-render";
import {
  extractBoardroomPendingActions,
  mapPriorityActionsToPending,
  type BoardroomPendingAction,
} from "@/lib/ai/boardroom-actions";
import { sanitizeChairRecommendationLinks } from "@/lib/ai/boardroom-links";
import { spendCredits } from "@/lib/ai/credits";
import { recordAiUsage } from "@/lib/ai/usage";
import { resolveAgentModel } from "@/lib/settings/ai-agents-catalog";
import type { Pillar } from "@/lib/permissions";

export type AgentStance = "silent" | "clarify" | "speak";

export interface AgentDecision {
  agentId: BoardroomAgentId;
  stance: AgentStance;
  clarifyQuestion?: string;
}

export interface AgentReply {
  agentId: BoardroomAgentId;
  content: string;
  structured: AgentStructuredOutput | null;
}

export interface SynthResult {
  content: string;
  structured: ChairRecommendation | null;
}

export interface BoardroomTurnResult {
  clarifierContent: string | null;
  agentReplies: AgentReply[];
  synthContent: string | null;
  synthStructured: ChairRecommendation | null;
  creditsCharged: number;
  awaitingClarifiers: boolean;
  decisions: AgentDecision[];
  pendingActions: BoardroomPendingAction[];
  depthState?: DepthState | null;
  awaitingDepthCheckpoint?: boolean;
}

export type DepthAction = "continue" | "accept" | "redirect";

export interface BoardroomTurnCallbacks {
  onTurnStart?: (speakers: BoardroomAgentId[]) => void | Promise<void>;
  onAgentStart?: (agentId: BoardroomAgentId) => void | Promise<void>;
  onAgentDone?: (reply: AgentReply) => void | Promise<void>;
  onAgentRetry?: (agentId: BoardroomAgentId, attempt: number) => void | Promise<void>;
  onRecommendationDone?: (result: SynthResult) => void | Promise<void>;
  onDepthRoundStart?: (round: number) => void | Promise<void>;
  onConfidenceUpdate?: (evaluation: ConfidenceEvaluation) => void | Promise<void>;
  onDepthCheckpoint?: (payload: {
    confidence: number;
    creditsSinceCheckpoint: number;
    partialSynth: SynthResult | null;
  }) => void | Promise<void>;
  onTurnEnd?: (payload: {
    creditsCharged: number;
  }) => void | Promise<void>;
}

const AGENT_MAX_RETRIES = 2;

const REVENUE_QUESTION_PATTERN =
  /\b(sale|sales|revenue|jual|jualan|pendapatan|income|profit|untung|target|customer|pelanggan|rm\s*\d|\d+\s*rm)\b/i;

/** When classify marks everyone silent, pick who should still speak. */
export function ensureBoardroomSpeakers(
  decisions: AgentDecision[],
  invited: BoardroomAgentId[],
  userMessage: string,
): AgentDecision[] {
  if (decisions.some((d) => d.stance !== "silent")) {
    return decisions;
  }

  const revenueQuestion = REVENUE_QUESTION_PATTERN.test(userMessage);

  if (revenueQuestion && invited.includes("sales")) {
    return decisions.map((d) =>
      d.agentId === "sales" || d.agentId === "finance"
        ? { ...d, stance: "speak" as const }
        : d,
    );
  }

  if (revenueQuestion) {
    const nonFinance = decisions.filter((d) => d.agentId !== "finance");
    return decisions.map((d) => {
      if (d.agentId === "finance") return { ...d, stance: "speak" as const };
      if (nonFinance[0] && d.agentId === nonFinance[0].agentId) {
        return { ...d, stance: "speak" as const };
      }
      return d;
    });
  }

  return decisions.map((d) => ({ ...d, stance: "speak" as const }));
}

function buildNoSpeakersSynth(
  invited: BoardroomAgentId[],
  userMessage: string,
): SynthResult {
  const revenueQuestion = REVENUE_QUESTION_PATTERN.test(userMessage);
  const content =
    revenueQuestion && !invited.includes("sales")
      ? "This is mainly a sales/revenue question. Invite **Sufi (Sales)** to the table, or ask Fayza about cash targets and Aiman about delivery capacity."
      : "No one in the room had enough context to speak on this. Try inviting another agent or rephrasing the question.";
  return { content, structured: null };
}

function modelForBoardroomAgent(
  agentId: BoardroomAgentId,
  agentModels: Partial<Record<BoardroomAgentId, string>> | undefined,
  fallback: string,
): string {
  return agentModels?.[agentId] ?? fallback;
}

function sortSpeakersByInviteOrder(
  invited: BoardroomAgentId[],
  decisions: AgentDecision[],
): AgentDecision[] {
  const order = new Map(invited.map((id, i) => [id, i]));
  return decisions
    .filter((d) => d.stance === "speak")
    .sort(
      (a, b) =>
        (order.get(a.agentId) ?? 0) - (order.get(b.agentId) ?? 0),
    );
}

function buildChairFallbackFromReplies(
  agentReplies: AgentReply[],
): ChairRecommendation {
  const priority_actions = agentReplies
    .flatMap((r) => {
      const action = r.structured?.actions?.[0];
      if (!action) return [];
      return [
        {
          id: slugActionId(action, 0),
          label: action.slice(0, 120),
          owner_agent: r.agentId,
          rationale:
            r.structured?.problem?.slice(0, 200) ?? "From staff discussion",
        },
      ];
    })
    .slice(0, 3);

  const verdict =
    agentReplies.find((r) => r.structured?.headline)?.structured?.headline ??
    agentReplies[0]?.structured?.problem ??
    "Review the staff views above and pick the highest-impact action to start.";

  return { verdict, priority_actions };
}

function pillarForAgent(id: BoardroomAgentId): Pillar {
  return id;
}

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
  const agentIdUnion = opts.invited.map((id) => `"${id}"`).join("|");

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
- silent — clearly not their domain AND another invited agent owns it
- clarify — related but need 1 short clarifying question first
- speak — related and confident enough to give a view/plan

Rules:
- Revenue, sales targets, growth, customers: sales speaks if invited; else finance AND at least one other invited agent speak.
- Cross-cutting business questions: prefer speak over silent for every invited agent with a useful angle.
- Use silent only when the topic clearly belongs to other invited agents only.

Return ONLY valid JSON:
{"decisions":[{"agentId":${agentIdUnion},"stance":"silent"|"clarify"|"speak","clarifyQuestion":"optional string"}]}

Invited agents:
${roster}`,
        },
        { role: "user", content: opts.userMessage },
      ],
    });

    const text = extractChatAssistantText(completion);
    const parsed = extractJsonObject(text) as {
      decisions?: Array<{
        agentId: string;
        stance: string;
        clarifyQuestion?: string;
      }>;
    } | null;
    if (!parsed) throw new Error("no json");

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

async function runAgentSpeakStructured(opts: {
  ctx: AgentContext;
  agentId: BoardroomAgentId;
  userMessage: string;
  priorNotes: string;
  model: string;
  displayName: string;
  mode: MeetingMode;
  ownerConstraint?: string;
  callbacks?: BoardroomTurnCallbacks;
  speakOrder: "first" | "follow";
  scopePolicy?: string;
  colleagueRoster?: string;
}): Promise<AgentReply> {
  const pillar = pillarForAgent(opts.agentId);
  const briefing = await buildBriefing(pillar, opts.ctx);

  let lastError: unknown;
  for (let attempt = 0; attempt <= AGENT_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await opts.callbacks?.onAgentRetry?.(opts.agentId, attempt);
    }

    try {
      const completion = await openaiChat<ChatCompletionResponse>({
        model: opts.model,
        temperature: 0.3,
        max_tokens: opts.mode === "depth" ? 300 : 400,
        includeBriefing: false,
        messages: [
          {
            role: "system",
            content: buildAgentBoardroomSystemPrompt({
              agentId: opts.agentId,
              displayName: opts.displayName,
              mode: opts.mode,
              priorNotes: opts.priorNotes,
              briefingText: briefing.text,
              ownerConstraint: opts.ownerConstraint,
              speakOrder: opts.speakOrder,
              scopePolicy: opts.scopePolicy,
              colleagueRoster: opts.colleagueRoster,
            }),
          },
          {
            role: "user",
            content: opts.userMessage.trim() || "Continue the boardroom discussion.",
          },
        ],
      });

      const text = extractChatAssistantText(completion);
      const parsed = parseAgentStructuredFromText(text);
      if (parsed) {
        return {
          agentId: opts.agentId,
          structured: parsed,
          content: renderAgentStructuredToMarkdown(parsed),
        };
      }

      return {
        agentId: opts.agentId,
        structured: null,
        content: renderPlainAgentFallback(text),
      };
    } catch (e) {
      lastError = e;
    }
  }

  const label = opts.displayName;
  return {
    agentId: opts.agentId,
    structured: null,
    content: `Could not reach ${label} this turn.`,
  };
}

async function runChairSynthesis(opts: {
  ctx: AgentContext;
  userMessage: string;
  agentReplies: AgentReply[];
  model: string;
  mode: MeetingMode;
  partialConfidence?: number;
  ownerConstraint?: string;
  scopePolicy?: string;
  displayNames?: Record<string, string>;
}): Promise<SynthResult> {
  if (opts.agentReplies.length === 0) {
    return {
      content:
        "The chair needs at least one staff view before recommending. Invite the right agent or rephrase the question.",
      structured: null,
    };
  }

  const body = opts.agentReplies
    .map((r) => {
      const payload = r.structured
        ? JSON.stringify(r.structured)
        : r.content;
      const who = resolveBoardroomDisplayName(r.agentId, opts.displayNames);
      return `### ${who}\n${payload}`;
    })
    .join("\n\n");

  try {
    const completion = await openaiChat<ChatCompletionResponse>({
      model: opts.model,
      temperature: 0.2,
      max_tokens: opts.mode === "depth" ? 380 : 450,
      includeBriefing: false,
      messages: [
        {
          role: "system",
          content: buildChairSynthesisSystemPrompt({
            mode: opts.mode,
            partialConfidence: opts.partialConfidence,
            ownerConstraint: opts.ownerConstraint,
            scopePolicy: opts.scopePolicy,
          }),
        },
        {
          role: "user",
          content: `Owner question:\n${opts.userMessage.trim() || "Synthesize staff views."}\n\nStaff structured views:\n${body}`,
        },
      ],
    });

    const text = extractChatAssistantText(completion);
    const parsed = parseChairRecommendation(extractJsonObject(text));
    if (parsed) {
      parsed.priority_actions = parsed.priority_actions.map((a, i) => ({
        ...a,
        id: a.id || slugActionId(a.label, i),
      }));
      const sanitized = await sanitizeChairRecommendationLinks({
        businessId: opts.ctx.businessId,
        rec: parsed,
      });
      return {
        structured: sanitized,
        content: renderChairRecommendationToMarkdown(
          sanitized,
          opts.displayNames,
        ),
      };
    }
  } catch {
    // fall through
  }

  const fallback = buildChairFallbackFromReplies(opts.agentReplies);
  return {
    structured: fallback,
    content: renderChairRecommendationToMarkdown(fallback, opts.displayNames),
  };
}

export async function evaluateRoomConfidence(opts: {
  userMessage: string;
  agentReplies: AgentReply[];
  model: string;
  displayNames?: Record<string, string>;
}): Promise<ConfidenceEvaluation> {
  const body = opts.agentReplies
    .map(
      (r) =>
        `${resolveBoardroomDisplayName(r.agentId, opts.displayNames)}: ${r.content}`,
    )
    .join("\n");

  try {
    const completion = await openaiChat<ChatCompletionResponse>({
      model: opts.model,
      temperature: 0.1,
      max_tokens: 180,
      includeBriefing: false,
      messages: [
        { role: "system", content: buildConfidenceEvaluationPrompt() },
        {
          role: "user",
          content: `Owner question:\n${opts.userMessage}\n\nRoom views:\n${body}`,
        },
      ],
    });

    const text = extractChatAssistantText(completion);
    const parsed = parseConfidenceEvaluation(extractJsonObject(text));
    if (parsed) return parsed;
  } catch {
    // fall through
  }

  return {
    score: 0.5,
    rationale: "Room needs more alignment before acting.",
    gaps: ["Unresolved differences between staff"],
  };
}

async function chargeAgentCredit(
  ctx: AgentContext,
  agentId: BoardroomAgentId,
): Promise<number> {
  try {
    const spend = await spendCredits(ctx, {
      amount: 1,
      reason: `boardroom.agent.${agentId}`,
    });
    if (spend.charged > 0) {
      await recordAiUsage({
        businessId: ctx.businessId,
        agentSlug: "boardroom",
        triggerType: "CHAT",
        creditsCharged: spend.charged,
        mode: spend.mode,
        metadata: { boardroom_agent: agentId, source: "boardroom" },
        actorUserId: ctx.userId,
      }).catch(() => {
        /* billing log must not block the meeting */
      });
    }
    return spend.charged;
  } catch {
    return 0;
  }
}

export async function runBoardroomSpeakTurn(opts: {
  ctx: AgentContext;
  invited: BoardroomAgentId[];
  userMessage: string;
  decisions: AgentDecision[];
  displayNames: Record<string, string>;
  model?: string;
  mode?: MeetingMode;
  callbacks?: BoardroomTurnCallbacks;
  ownerConstraint?: string;
  agentModels?: Partial<Record<BoardroomAgentId, string>>;
  chairModel?: string;
  scopePolicy?: string;
}): Promise<BoardroomTurnResult> {
  const defaultModel =
    opts.chairModel ??
    opts.model ??
    resolveAgentModel({ reasoningMode: "fast", modelOverride: null });
  const mode = opts.mode ?? "normal";

  const speakers = sortSpeakersByInviteOrder(opts.invited, opts.decisions);
  await opts.callbacks?.onTurnStart?.(speakers.map((s) => s.agentId));

  const agentReplies: AgentReply[] = [];
  let creditsCharged = 0;
  let priorNotes = "";
  const colleagueRoster = buildColleagueRoster(opts.invited, opts.displayNames);

  for (const d of speakers) {
    await opts.callbacks?.onAgentStart?.(d.agentId);
    const reply = await runAgentSpeakStructured({
      ctx: opts.ctx,
      agentId: d.agentId,
      userMessage: opts.userMessage,
      priorNotes,
      model: modelForBoardroomAgent(d.agentId, opts.agentModels, defaultModel),
      displayName: opts.displayNames[d.agentId] || boardroomAgentLabel(d.agentId),
      mode,
      ownerConstraint: opts.ownerConstraint,
      callbacks: opts.callbacks,
      speakOrder: priorNotes ? "follow" : "first",
      scopePolicy: opts.scopePolicy,
      colleagueRoster,
    });
    agentReplies.push(reply);
    priorNotes += `\n${formatAgentNoteForChain(reply, opts.displayNames)}`;
    await opts.callbacks?.onAgentDone?.(reply);
    creditsCharged += await chargeAgentCredit(opts.ctx, d.agentId);
  }

  let synthContent: string | null = null;
  let synthStructured: ChairRecommendation | null = null;

  if (agentReplies.length > 0) {
    const synth = await runChairSynthesis({
      ctx: opts.ctx,
      userMessage: opts.userMessage,
      agentReplies,
      model: defaultModel,
      mode,
      ownerConstraint: opts.ownerConstraint,
      scopePolicy: opts.scopePolicy,
      displayNames: opts.displayNames,
    });
    synthContent = synth.content;
    synthStructured = synth.structured;
    await opts.callbacks?.onRecommendationDone?.(synth);
  } else {
    const empty = buildNoSpeakersSynth(opts.invited, opts.userMessage);
    synthContent = empty.content;
    synthStructured = empty.structured;
    await opts.callbacks?.onRecommendationDone?.(empty);
  }

  const pendingActions =
    synthStructured && agentReplies.length > 0
      ? await resolvePendingActions({
          ctx: opts.ctx,
          invited: opts.invited,
          userMessage: opts.userMessage,
          synthStructured,
          agentReplies,
          model: defaultModel,
          displayNames: opts.displayNames,
        })
      : [];

  await opts.callbacks?.onTurnEnd?.({ creditsCharged });

  return {
    clarifierContent: null,
    agentReplies,
    synthContent,
    synthStructured,
    creditsCharged,
    awaitingClarifiers: false,
    decisions: opts.decisions,
    pendingActions,
  };
}

async function resolvePendingActions(opts: {
  ctx: AgentContext;
  invited: BoardroomAgentId[];
  userMessage: string;
  synthStructured: ChairRecommendation;
  agentReplies: AgentReply[];
  model: string;
  displayNames?: Record<string, string>;
}): Promise<BoardroomPendingAction[]> {
  const fromChair = mapPriorityActionsToPending(opts.synthStructured.priority_actions);
  if (fromChair.length > 0) return fromChair;

  const legacy = await extractBoardroomPendingActions({
    invited: opts.invited,
    userMessage: opts.userMessage,
    synthContent: renderChairRecommendationToMarkdown(
      opts.synthStructured,
      opts.displayNames,
    ),
    agentReplies: opts.agentReplies.map((r) => ({
      agentId: r.agentId,
      content: r.content,
    })),
    model: opts.model,
  });
  return legacy;
}

export async function runBoardroomDepthTurn(opts: {
  ctx: AgentContext;
  invited: BoardroomAgentId[];
  userMessage: string;
  decisions: AgentDecision[];
  displayNames: Record<string, string>;
  depthState: DepthState;
  model?: string;
  callbacks?: BoardroomTurnCallbacks;
  depthAction?: DepthAction;
  redirectMessage?: string;
  agentsJoined?: BoardroomAgentId[];
  agentModels?: Partial<Record<BoardroomAgentId, string>>;
  chairModel?: string;
  scopePolicy?: string;
}): Promise<BoardroomTurnResult> {
  const defaultModel =
    opts.chairModel ??
    opts.model ??
    resolveAgentModel({ reasoningMode: "fast", modelOverride: null });

  let state: DepthState = { ...opts.depthState };
  let ownerConstraint = state.owner_constraint;

  if (opts.depthAction === "redirect" && opts.redirectMessage?.trim()) {
    ownerConstraint = opts.redirectMessage.trim();
    state = {
      round: 1,
      confidence: 0,
      credits_since_checkpoint: 0,
      paused_at_checkpoint: false,
      owner_constraint: ownerConstraint,
      speaker_decisions: undefined,
    };
  } else if (opts.depthAction === "continue") {
    state = {
      ...state,
      paused_at_checkpoint: false,
      credits_since_checkpoint: 0,
      speaker_decisions:
        opts.agentsJoined && opts.agentsJoined.length > 0
          ? undefined
          : state.speaker_decisions,
    };
  }

  const allReplies: AgentReply[] = [];
  let creditsCharged = 0;
  let lastSynth: SynthResult | null = null;
  let lastEvaluation: ConfidenceEvaluation | null = null;

  const speakers = sortSpeakersByInviteOrder(opts.invited, opts.decisions);
  await opts.callbacks?.onTurnStart?.(speakers.map((s) => s.agentId));

  if (speakers.length === 0) {
    const empty = buildNoSpeakersSynth(opts.invited, opts.userMessage);
    state.speaker_decisions = opts.decisions;
    await opts.callbacks?.onRecommendationDone?.(empty);
    await opts.callbacks?.onTurnEnd?.({ creditsCharged: 0 });
    return {
      clarifierContent: null,
      agentReplies: [],
      synthContent: empty.content,
      synthStructured: empty.structured,
      creditsCharged: 0,
      awaitingClarifiers: false,
      decisions: opts.decisions,
      pendingActions: [],
      depthState: state,
      awaitingDepthCheckpoint: false,
    };
  }

  state.speaker_decisions = opts.decisions;

  await opts.callbacks?.onDepthRoundStart?.(state.round);

  let priorNotes = "";
  const colleagueRoster = buildColleagueRoster(opts.invited, opts.displayNames);
  for (const d of speakers) {
    await opts.callbacks?.onAgentStart?.(d.agentId);
    const reply = await runAgentSpeakStructured({
      ctx: opts.ctx,
      agentId: d.agentId,
      userMessage: opts.userMessage,
      priorNotes,
      model: modelForBoardroomAgent(d.agentId, opts.agentModels, defaultModel),
      displayName: opts.displayNames[d.agentId] || boardroomAgentLabel(d.agentId),
      mode: "depth",
      ownerConstraint,
      callbacks: opts.callbacks,
      speakOrder: priorNotes ? "follow" : "first",
      scopePolicy: opts.scopePolicy,
      colleagueRoster,
    });
    allReplies.push(reply);
    priorNotes += `\n${formatAgentNoteForChain(reply, opts.displayNames)}`;
    await opts.callbacks?.onAgentDone?.(reply);
    const charged = await chargeAgentCredit(opts.ctx, d.agentId);
    creditsCharged += charged;
    state.credits_since_checkpoint += charged;
  }

  state.round += 1;

  lastEvaluation = await evaluateRoomConfidence({
    userMessage: opts.userMessage,
    agentReplies: allReplies,
    model: defaultModel,
    displayNames: opts.displayNames,
  });
  state.confidence = lastEvaluation.score;
  await opts.callbacks?.onConfidenceUpdate?.(lastEvaluation);

  if (lastEvaluation.score >= DEPTH_CONFIDENCE_THRESHOLD) {
    lastSynth = await runChairSynthesis({
      ctx: opts.ctx,
      userMessage: opts.userMessage,
      agentReplies: allReplies,
      model: defaultModel,
      mode: "depth",
      ownerConstraint,
      scopePolicy: opts.scopePolicy,
      displayNames: opts.displayNames,
    });
    await opts.callbacks?.onRecommendationDone?.(lastSynth);
  } else if (opts.depthAction === "accept") {
    lastSynth = await runChairSynthesis({
      ctx: opts.ctx,
      userMessage: opts.userMessage,
      agentReplies: allReplies,
      model: defaultModel,
      mode: "depth",
      partialConfidence: lastEvaluation.score,
      ownerConstraint,
      scopePolicy: opts.scopePolicy,
      displayNames: opts.displayNames,
    });
    await opts.callbacks?.onRecommendationDone?.(lastSynth);
  } else {
    const partial = await runChairSynthesis({
      ctx: opts.ctx,
      userMessage: opts.userMessage,
      agentReplies: allReplies,
      model: defaultModel,
      mode: "depth",
      partialConfidence: lastEvaluation.score,
      ownerConstraint,
      scopePolicy: opts.scopePolicy,
      displayNames: opts.displayNames,
    });
    lastSynth = partial;
    state.paused_at_checkpoint = true;
    await opts.callbacks?.onRecommendationDone?.(lastSynth);
    await opts.callbacks?.onDepthCheckpoint?.({
      confidence: lastEvaluation.score,
      creditsSinceCheckpoint: state.credits_since_checkpoint,
      partialSynth: partial,
    });
    await opts.callbacks?.onTurnEnd?.({ creditsCharged });
    return {
      clarifierContent: null,
      agentReplies: allReplies,
      synthContent: partial.content,
      synthStructured: partial.structured,
      creditsCharged,
      awaitingClarifiers: false,
      decisions: opts.decisions,
      pendingActions: [],
      depthState: state,
      awaitingDepthCheckpoint: true,
    };
  }

  const pendingActions = lastSynth?.structured
    ? await resolvePendingActions({
        ctx: opts.ctx,
        invited: opts.invited,
        userMessage: opts.userMessage,
        synthStructured: lastSynth.structured,
        agentReplies: allReplies,
        model: defaultModel,
        displayNames: opts.displayNames,
      })
    : [];

  state.paused_at_checkpoint = false;
  await opts.callbacks?.onTurnEnd?.({ creditsCharged });

  return {
    clarifierContent: null,
    agentReplies: allReplies,
    synthContent: lastSynth.content,
    synthStructured: lastSynth.structured,
    creditsCharged,
    awaitingClarifiers: false,
    decisions: opts.decisions,
    pendingActions,
    depthState: state,
    awaitingDepthCheckpoint: false,
  };
}

export async function runBoardroomUserTurn(opts: {
  ctx: AgentContext;
  invited: BoardroomAgentId[];
  userMessage: string;
  answeringClarifiers: boolean;
  priorDecisions?: AgentDecision[];
  displayNames: Record<string, string>;
  mode?: MeetingMode;
  depthState?: DepthState | null;
  depthAction?: DepthAction;
  redirectMessage?: string;
  agentsJoined?: BoardroomAgentId[];
  callbacks?: BoardroomTurnCallbacks;
  agentModels?: Partial<Record<BoardroomAgentId, string>>;
  chairModel?: string;
  scopePolicy?: string;
}): Promise<BoardroomTurnResult> {
  const chairModel =
    opts.chairModel ??
    resolveAgentModel({ reasoningMode: "fast", modelOverride: null });

  const userMessage = opts.userMessage.trim();

  const reuseDepthDecisions =
    !opts.agentsJoined?.length &&
    (opts.depthAction === "continue" || opts.depthAction === "accept") &&
    (opts.depthState?.speaker_decisions?.length ?? 0) > 0;

  let decisions = opts.priorDecisions;
  if (reuseDepthDecisions) {
    decisions = opts.depthState!.speaker_decisions!.map((d) => ({
      agentId: d.agentId as BoardroomAgentId,
      stance: d.stance,
      clarifyQuestion: d.clarifyQuestion,
    }));
  } else if (!opts.answeringClarifiers || !decisions) {
    decisions = await classifyRoomAgents({
      ctx: opts.ctx,
      invited: opts.invited,
      userMessage: userMessage || "Continue the boardroom discussion.",
      model: chairModel,
    });
  }

  decisions = ensureBoardroomSpeakers(
    decisions,
    opts.invited,
    userMessage || "Continue the boardroom discussion.",
  );

  if (opts.agentsJoined?.length) {
    const joined = new Set(opts.agentsJoined);
    const byId = new Map(decisions.map((d) => [d.agentId, d]));
    for (const agentId of opts.agentsJoined) {
      const existing = byId.get(agentId);
      if (existing) {
        byId.set(agentId, { ...existing, stance: "speak" });
      } else {
        byId.set(agentId, { agentId, stance: "speak" });
      }
    }
    decisions = opts.invited
      .map((id) => byId.get(id))
      .filter((d): d is AgentDecision => d != null);
  }

  const needClarify =
    !opts.answeringClarifiers &&
    decisions.some((d) => d.stance === "clarify");

  if (needClarify) {
    return {
      clarifierContent: buildCombinedClarifier(decisions, opts.displayNames),
      agentReplies: [],
      synthContent: null,
      synthStructured: null,
      creditsCharged: 0,
      awaitingClarifiers: true,
      decisions,
      pendingActions: [],
    };
  }

  const speakDecisions = decisions.map((d) =>
    d.stance === "clarify" ? { ...d, stance: "speak" as const } : d,
  );

  const mode = opts.mode ?? "normal";

  if (mode === "depth") {
    const initialDepth: DepthState = opts.depthState ?? {
      round: 1,
      confidence: 0,
      credits_since_checkpoint: 0,
      paused_at_checkpoint: false,
    };

    const ownerFeedback =
      initialDepth.paused_at_checkpoint &&
      userMessage &&
      !opts.depthAction
        ? userMessage
        : undefined;

    const depthAction =
      ownerFeedback != null ? ("redirect" as const) : opts.depthAction;
    const redirectMessage = ownerFeedback ?? opts.redirectMessage;

    if (depthAction || initialDepth.paused_at_checkpoint) {
      return runBoardroomDepthTurn({
        ctx: opts.ctx,
        invited: opts.invited,
        userMessage: userMessage || redirectMessage || "Continue the boardroom discussion.",
        decisions: speakDecisions,
        displayNames: opts.displayNames,
        depthState: initialDepth,
        chairModel,
        agentModels: opts.agentModels,
        callbacks: opts.callbacks,
        depthAction,
        redirectMessage,
        agentsJoined: opts.agentsJoined,
        scopePolicy: opts.scopePolicy,
      });
    }

    return runBoardroomDepthTurn({
      ctx: opts.ctx,
      invited: opts.invited,
      userMessage: userMessage || "Continue the boardroom discussion.",
      decisions: speakDecisions,
      displayNames: opts.displayNames,
      depthState: initialDepth,
      chairModel,
      agentModels: opts.agentModels,
      callbacks: opts.callbacks,
      agentsJoined: opts.agentsJoined,
      scopePolicy: opts.scopePolicy,
    });
  }

  return runBoardroomSpeakTurn({
    ctx: opts.ctx,
    invited: opts.invited,
    userMessage: userMessage || "Continue the boardroom discussion.",
    decisions: speakDecisions,
    displayNames: opts.displayNames,
    chairModel,
    agentModels: opts.agentModels,
    mode: "normal",
    callbacks: opts.callbacks,
    scopePolicy: opts.scopePolicy,
  });
}
