import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentContext } from "@/lib/ai/context/types";
import {
  executeBoardroomPendingActions,
  filterPendingActionsByIds,
  isBoardroomCreateConfirm,
  mapPriorityActionsToPending,
  type BoardroomPendingAction,
} from "@/lib/ai/boardroom-actions";
import type { DepthState, MeetingMode } from "@/lib/ai/boardroom-output-schema";
import {
  composeBoardroomScopePolicy,
  loadPublishedAgentScope,
} from "@/lib/ai/agent-scope-runtime";
import {
  runBoardroomUserTurn,
  type AgentDecision,
  type AgentReply,
  type BoardroomTurnCallbacks,
  type BoardroomTurnResult,
  type DepthAction,
} from "@/lib/ai/boardroom-orchestrator";
import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";
import { applyBoardroomMeetingInvites } from "@/lib/ai/boardroom-invite";
import { boardroomAgentLabel } from "@/lib/ai/boardroom-access";
import {
  getCreditBalance,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { resolveAgentModel } from "@/lib/settings/ai-agents-catalog";

/** Never send an empty user message to the LLM (ilmu rejects it). */
export async function resolveBoardroomUserMessage(opts: {
  supabase: SupabaseClient;
  meetingId: string;
  businessId: string;
  text?: string;
  depthAction?: DepthAction;
  redirectMessage?: string;
}): Promise<string> {
  const trimmed = opts.text?.trim();
  if (trimmed) return trimmed;

  const redirect = opts.redirectMessage?.trim();
  if (redirect) return redirect;

  if (opts.depthAction === "continue") {
    return "Owner wants the room to continue debating with the prior context.";
  }
  if (opts.depthAction === "accept") {
    return "Owner accepts the current partial plan — synthesize the best actionable next steps.";
  }
  if (opts.depthAction === "redirect") {
    return "Owner redirected the room — revise the plan with their new direction.";
  }

  const { data: priorUsers } = await opts.supabase
    .from("boardroom_messages")
    .select("content")
    .eq("meeting_id", opts.meetingId)
    .eq("business_id", opts.businessId)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(1);

  return (
    priorUsers?.[0]?.content?.trim() ??
    "Continue the boardroom discussion with prior context."
  );
}

export type BoardroomMeetingRow = {
  id: string;
  status: string;
  invited_agent_ids: string[];
  awaiting_clarifiers?: boolean;
  pending_decisions?: unknown;
  pending_actions?: unknown;
  credits_spent: number;
  meeting_mode?: string;
  depth_state?: DepthState | null;
};

/** Per-agent effective models (respects super-admin override + reasoning mode). */
export async function loadBoardroomRouting(opts: {
  businessId: string;
  invited: BoardroomAgentId[];
}): Promise<{
  displayNames: Record<string, string>;
  agentModels: Partial<Record<BoardroomAgentId, string>>;
  chairModel: string;
}> {
  const boardroomSettings = await loadBusinessAgentSettings(
    opts.businessId,
    "boardroom",
  );
  const chairModel = resolveAgentModel({
    reasoningMode: boardroomSettings.reasoningMode,
    modelOverride: boardroomSettings.modelOverride,
  });

  const displayNames: Record<string, string> = {};
  const agentModels: Partial<Record<BoardroomAgentId, string>> = {};

  await Promise.all(
    opts.invited.map(async (agentId) => {
      const settings = await loadBusinessAgentSettings(opts.businessId, agentId);
      displayNames[agentId] = settings.displayName;
      const override = settings.modelOverride?.trim();
      agentModels[agentId] = override
        ? resolveAgentModel({
            reasoningMode: settings.reasoningMode,
            modelOverride: override,
          })
        : chairModel;
    }),
  );

  return { displayNames, agentModels, chairModel };
}

/** Merge call-in agents at a depth checkpoint (or mid-meeting). */
export async function applyMeetingInvitesIfAny(opts: {
  supabase: SupabaseClient;
  businessId: string;
  meeting: BoardroomMeetingRow;
  inviteAgentIds?: string[];
}): Promise<
  | { meeting: BoardroomMeetingRow; agentsJoined: BoardroomAgentId[] }
  | { error: string }
> {
  if (!opts.inviteAgentIds?.length) {
    return {
      meeting: opts.meeting,
      agentsJoined: [],
    };
  }

  const current = (opts.meeting.invited_agent_ids ?? []) as BoardroomAgentId[];
  const result = await applyBoardroomMeetingInvites({
    supabase: opts.supabase,
    businessId: opts.businessId,
    meetingId: opts.meeting.id,
    currentInvited: current,
    inviteAgentIds: opts.inviteAgentIds,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  return {
    meeting: {
      ...opts.meeting,
      invited_agent_ids: result.invited,
    },
    agentsJoined: result.added,
  };
}

export async function persistBoardroomTurn(opts: {
  supabase: SupabaseClient;
  businessId: string;
  meetingId: string;
  meeting: BoardroomMeetingRow;
  result: BoardroomTurnResult;
}): Promise<void> {
  const { supabase, businessId, meetingId, meeting, result } = opts;
  const newMessages: Array<{
    business_id: string;
    meeting_id: string;
    role: string;
    agent_id?: string | null;
    content: string;
    meta?: Record<string, unknown>;
  }> = [];

  if (result.clarifierContent) {
    newMessages.push({
      business_id: businessId,
      meeting_id: meetingId,
      role: "room_clarifier",
      content: result.clarifierContent,
      meta: { free: true },
    });
  }

  for (const reply of result.agentReplies) {
    newMessages.push({
      business_id: businessId,
      meeting_id: meetingId,
      role: "agent",
      agent_id: reply.agentId,
      content: reply.content,
      meta: {
        credits: 1,
        structured: reply.structured ?? undefined,
        round: result.depthState?.round,
      },
    });
  }

  if (result.synthContent) {
    newMessages.push({
      business_id: businessId,
      meeting_id: meetingId,
      role: "synth",
      content: result.synthContent,
      meta: {
        free: true,
        structured: result.synthStructured ?? undefined,
        priority_actions: result.pendingActions,
        confidence: result.depthState?.confidence,
      },
    });
  }

  if (newMessages.length > 0) {
    await supabase.from("boardroom_messages").insert(newMessages);
  }

  const patch: Record<string, unknown> = {
    awaiting_clarifiers: result.awaitingClarifiers,
    credits_spent: Number(meeting.credits_spent ?? 0) + result.creditsCharged,
    pending_decisions: result.awaitingClarifiers ? result.decisions : null,
    pending_actions:
      result.awaitingDepthCheckpoint || result.pendingActions.length === 0
        ? null
        : result.pendingActions,
    depth_state: result.depthState ?? meeting.depth_state ?? null,
  };

  await supabase
    .from("boardroom_meetings")
    .update(patch)
    .eq("id", meetingId)
    .eq("business_id", businessId);
}

export async function runAndPersistBoardroomTurn(opts: {
  supabase: SupabaseClient;
  ctx: AgentContext;
  businessId: string;
  meeting: BoardroomMeetingRow;
  userMessage: string;
  answeringClarifiers: boolean;
  priorDecisions?: AgentDecision[];
  displayNames: Record<string, string>;
  callbacks?: BoardroomTurnCallbacks;
  depthAction?: DepthAction;
  redirectMessage?: string;
  agentsJoined?: BoardroomAgentId[];
  agentModels?: Partial<Record<BoardroomAgentId, string>>;
  chairModel?: string;
}): Promise<{
  result: BoardroomTurnResult;
  creditBalance: number;
}> {
  const mode = (opts.meeting.meeting_mode ?? "normal") as MeetingMode;
  const depthState = (opts.meeting.depth_state as DepthState | null) ?? null;
  const boardroomScope = await loadPublishedAgentScope("boardroom");
  const scopePolicy = composeBoardroomScopePolicy(boardroomScope);

  const result = await runBoardroomUserTurn({
    ctx: opts.ctx,
    invited: (opts.meeting.invited_agent_ids ?? []) as BoardroomAgentId[],
    userMessage: opts.userMessage,
    answeringClarifiers: opts.answeringClarifiers,
    priorDecisions: opts.priorDecisions,
    displayNames: opts.displayNames,
    mode,
    depthState,
    depthAction: opts.depthAction,
    redirectMessage: opts.redirectMessage,
    agentsJoined: opts.agentsJoined,
    agentModels: opts.agentModels,
    chairModel: opts.chairModel,
    callbacks: opts.callbacks,
    scopePolicy,
  });

  await persistBoardroomTurn({
    supabase: opts.supabase,
    businessId: opts.businessId,
    meetingId: opts.meeting.id,
    meeting: opts.meeting,
    result,
  });

  const creditBalance = await getCreditBalance(opts.businessId);
  return { result, creditBalance };
}

export async function executeSelectedBoardroomActions(opts: {
  supabase: SupabaseClient;
  ctx: AgentContext;
  businessId: string;
  meetingId: string;
  pendingActions: BoardroomPendingAction[];
  actionIds: string[];
}): Promise<string> {
  const selected = filterPendingActionsByIds(
    opts.pendingActions,
    opts.actionIds,
  );
  const lines = await executeBoardroomPendingActions({
    ctx: opts.ctx,
    actions: selected,
  });
  const content =
    lines.length > 0
      ? `Done:\n${lines.map((l) => `· ${l}`).join("\n")}`
      : "Nothing was executed. Try again with clearer details.";

  await opts.supabase.from("boardroom_messages").insert({
    business_id: opts.businessId,
    meeting_id: opts.meetingId,
    role: "system",
    content,
    meta: { action_execute: true, action_ids: opts.actionIds },
  });

  await opts.supabase
    .from("boardroom_meetings")
    .update({ pending_actions: null })
    .eq("id", opts.meetingId)
    .eq("business_id", opts.businessId);

  return content;
}

export async function handleCreateConfirm(opts: {
  supabase: SupabaseClient;
  ctx: AgentContext;
  businessId: string;
  meetingId: string;
  pendingActions: BoardroomPendingAction[];
}): Promise<string> {
  const lines = await executeBoardroomPendingActions({
    ctx: opts.ctx,
    actions: opts.pendingActions,
  });
  const content =
    lines.length > 0
      ? `Created:\n${lines.map((l) => `· ${l}`).join("\n")}`
      : "Nothing was created. Ask again with clearer details.";

  await opts.supabase.from("boardroom_messages").insert({
    business_id: opts.businessId,
    meeting_id: opts.meetingId,
    role: "system",
    content,
    meta: { create_confirm: true },
  });

  await opts.supabase
    .from("boardroom_meetings")
    .update({ pending_actions: null })
    .eq("id", opts.meetingId)
    .eq("business_id", opts.businessId);

  return content;
}

export function sseEvent(
  event: string,
  payload: Record<string, unknown>,
): string {
  return `data: ${JSON.stringify({ event, ...payload })}\n\n`;
}

export type StreamEmit = (chunk: string) => void;

export function buildStreamCallbacks(emit: StreamEmit): BoardroomTurnCallbacks {
  return {
    onTurnStart: (speakers) => {
      emit(sseEvent("turn_start", { speakers }));
    },
    onAgentStart: (agentId) => {
      emit(
        sseEvent("agent_start", {
          agentId,
          label: boardroomAgentLabel(agentId),
        }),
      );
    },
    onAgentRetry: (agentId, attempt) => {
      emit(sseEvent("agent_retry", { agentId, attempt }));
    },
    onAgentDone: (reply: AgentReply) => {
      emit(
        sseEvent("agent_done", {
          agentId: reply.agentId,
          content: reply.content,
          structured: reply.structured,
        }),
      );
    },
    onRecommendationDone: (synth) => {
      emit(
        sseEvent("recommendation_done", {
          content: synth.content,
          structured: synth.structured,
          priority_actions: synth.structured
            ? mapPriorityActionsToPending(synth.structured.priority_actions)
            : [],
        }),
      );
    },
    onDepthRoundStart: (round) => {
      emit(sseEvent("depth_round_start", { round }));
    },
    onConfidenceUpdate: (evaluation) => {
      emit(sseEvent("confidence_update", evaluation));
    },
    onDepthCheckpoint: (payload) => {
      emit(
        sseEvent("depth_checkpoint", {
          confidence: payload.confidence,
          creditsSinceCheckpoint: payload.creditsSinceCheckpoint,
          partialContent: payload.partialSynth?.content,
          partialStructured: payload.partialSynth?.structured,
        }),
      );
    },
    onTurnEnd: ({ creditsCharged }) => {
      emit(sseEvent("turn_end", { credits_charged: creditsCharged }));
    },
  };
}

export { isBoardroomCreateConfirm };
