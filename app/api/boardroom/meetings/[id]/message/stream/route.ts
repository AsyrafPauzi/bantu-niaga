import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { resolveAgentContext } from "@/lib/ai/context";
import { canManageBoardroom } from "@/lib/ai/boardroom-access";
import type { AgentDecision } from "@/lib/ai/boardroom-orchestrator";
import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";
import {
  applyMeetingInvitesIfAny,
  buildStreamCallbacks,
  executeSelectedBoardroomActions,
  handleCreateConfirm,
  isBoardroomCreateConfirm,
  resolveBoardroomUserMessage,
  loadBoardroomRouting,
  runAndPersistBoardroomTurn,
  sseEvent,
  type BoardroomMeetingRow,
} from "@/lib/ai/boardroom-turn-handler";
import type { BoardroomPendingAction } from "@/lib/ai/boardroom-actions";
import { getCreditBalance } from "@/lib/marketplace/entitlements";
import { logger } from "@/lib/logger";
import { consume, rateLimitHeaders } from "@/lib/api/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isInsufficientCreditsError } from "@/lib/ai/credits";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

const streamSchema = z.object({
  message: z.string().trim().min(1).max(4000).optional(),
  stream: z.literal(true).optional(),
  execute_action_ids: z.array(z.string()).optional(),
  depth_action: z.enum(["continue", "accept", "redirect"]).optional(),
  redirect_message: z.string().max(2000).optional(),
  invite_agent_ids: z.array(z.string()).optional(),
});

async function requireBoardroomUser() {
  try {
    const user = await getCurrentUser();
    if (!canManageBoardroom(user.role)) {
      return {
        user: null,
        response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
      };
    }
    return { user, response: null };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "unauthorized", code: e.code },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

/** POST /api/boardroom/meetings/[id]/message/stream — SSE turn */
export async function POST(request: Request, context: RouteContext) {
  const { user, response } = await requireBoardroomUser();
  if (response) return response;

  const rl = consume({
    bucket: "boardroom.message",
    identifier: `user:${user.id}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many messages. Pause a moment.",
        retry_after_seconds: rl.retryAfterSeconds,
      },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = streamSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const { data: meeting } = await supabase
    .from("boardroom_meetings")
    .select(
      "id, status, invited_agent_ids, awaiting_clarifiers, pending_decisions, pending_actions, credits_spent, meeting_mode, depth_state",
    )
    .eq("id", id)
    .eq("business_id", user.businessId)
    .maybeSingle();

  if (!meeting) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (meeting.status !== "active") {
    return NextResponse.json(
      {
        error: "not_active",
        message: "Resume the meeting before sending messages.",
      },
      { status: 400 },
    );
  }

  const meetingRow = meeting as BoardroomMeetingRow;
  const pendingActions = (meeting.pending_actions ??
    []) as BoardroomPendingAction[];

  if (parsed.execute_action_ids && parsed.execute_action_ids.length > 0) {
    try {
      const ctx = await resolveAgentContext();
      await executeSelectedBoardroomActions({
        supabase,
        ctx,
        businessId: user.businessId,
        meetingId: id,
        pendingActions,
        actionIds: parsed.execute_action_ids,
      });
      const { data: messages } = await supabase
        .from("boardroom_messages")
        .select("id, role, agent_id, content, meta, created_at")
        .eq("meeting_id", id)
        .eq("business_id", user.businessId)
        .order("created_at", { ascending: true });

      return NextResponse.json({
        messages: messages ?? [],
        credit_balance: await getCreditBalance(user.businessId),
      });
    } catch (error) {
      logger.error("boardroom.execute_actions.failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: "execute_failed", message: "Could not run selected actions." },
        { status: 503 },
      );
    }
  }

  if (!parsed.message && !parsed.depth_action) {
    return NextResponse.json(
      { error: "validation_failed", message: "message required" },
      { status: 400 },
    );
  }

  const answeringClarifiers = meeting.awaiting_clarifiers === true;
  const text = parsed.message ?? "";

  const turnMessage = await resolveBoardroomUserMessage({
    supabase,
    meetingId: id,
    businessId: user.businessId,
    text,
    depthAction: parsed.depth_action,
    redirectMessage: parsed.redirect_message,
  });

  if (
    text &&
    !answeringClarifiers &&
    !parsed.depth_action &&
    pendingActions.length > 0 &&
    isBoardroomCreateConfirm(text)
  ) {
    try {
      const ctx = await resolveAgentContext();
      await handleCreateConfirm({
        supabase,
        ctx,
        businessId: user.businessId,
        meetingId: id,
        pendingActions,
      });
      const { data: messages } = await supabase
        .from("boardroom_messages")
        .select("id, role, agent_id, content, meta, created_at")
        .eq("meeting_id", id)
        .eq("business_id", user.businessId)
        .order("created_at", { ascending: true });

      return NextResponse.json({
        messages: messages ?? [],
        credit_balance: await getCreditBalance(user.businessId),
        created: true,
      });
    } catch (error) {
      logger.error("boardroom.create_confirm.failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: "create_failed", message: "Could not create drafts." },
        { status: 503 },
      );
    }
  }

  if (text) {
    await supabase.from("boardroom_messages").insert({
      business_id: user.businessId,
      meeting_id: id,
      role: "user",
      content: text,
    });
  } else if (parsed.depth_action === "redirect" && parsed.redirect_message?.trim()) {
    await supabase.from("boardroom_messages").insert({
      business_id: user.businessId,
      meeting_id: id,
      role: "user",
      content: parsed.redirect_message.trim(),
    });
  } else if (parsed.depth_action === "continue") {
    await supabase.from("boardroom_messages").insert({
      business_id: user.businessId,
      meeting_id: id,
      role: "user",
      content: "Continue debating",
    });
  } else if (parsed.depth_action === "accept") {
    await supabase.from("boardroom_messages").insert({
      business_id: user.businessId,
      meeting_id: id,
      role: "user",
      content: "Use what we have",
    });
  }

  let activeMeeting = meetingRow;
  let agentsJoined: BoardroomAgentId[] = [];
  if (parsed.invite_agent_ids?.length) {
    const inviteResult = await applyMeetingInvitesIfAny({
      supabase,
      businessId: user.businessId,
      meeting: activeMeeting,
      inviteAgentIds: parsed.invite_agent_ids,
    });
    if ("error" in inviteResult) {
      return NextResponse.json(
        { error: "invite_failed", message: inviteResult.error },
        { status: 400 },
      );
    }
    activeMeeting = inviteResult.meeting;
    agentsJoined = inviteResult.agentsJoined;
  }

  const invited = (activeMeeting.invited_agent_ids ?? []) as BoardroomAgentId[];
  const { displayNames, agentModels, chairModel } = await loadBoardroomRouting({
    businessId: user.businessId,
    invited,
  });

  let resolvedTurnMessage = turnMessage;
  if (answeringClarifiers && text) {
    const { data: priorUsers } = await supabase
      .from("boardroom_messages")
      .select("content")
      .eq("meeting_id", id)
      .eq("business_id", user.businessId)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(2);
    const original =
      priorUsers && priorUsers.length >= 2
        ? priorUsers[1].content
        : priorUsers?.[0]?.content;
    resolvedTurnMessage = original
      ? `Original question:\n${original}\n\nOwner clarifier answers:\n${text}`
      : text;
  }

  const priorDecisions = answeringClarifiers
    ? ((meeting.pending_decisions as AgentDecision[] | null) ?? undefined)
    : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      try {
        const ctx = await resolveAgentContext();
        const { result, creditBalance } = await runAndPersistBoardroomTurn({
          supabase,
          ctx,
          businessId: user.businessId,
          meeting: activeMeeting,
          userMessage: resolvedTurnMessage,
          answeringClarifiers,
          priorDecisions,
          displayNames,
          agentModels,
          chairModel,
          callbacks: buildStreamCallbacks(emit),
          depthAction: parsed.depth_action,
          redirectMessage: parsed.redirect_message,
          agentsJoined,
        });

        const { data: messages } = await supabase
          .from("boardroom_messages")
          .select("id, role, agent_id, content, meta, created_at")
          .eq("meeting_id", id)
          .eq("business_id", user.businessId)
          .order("created_at", { ascending: true });

        emit(
          sseEvent("done", {
            awaiting_clarifiers: result.awaitingClarifiers,
            awaiting_depth_checkpoint: result.awaitingDepthCheckpoint ?? false,
            credits_charged: result.creditsCharged,
            credit_balance: creditBalance,
            depth_state: result.depthState ?? null,
            invited_agent_ids: activeMeeting.invited_agent_ids ?? [],
            messages: messages ?? [],
            pending_actions: result.pendingActions,
          }),
        );
        controller.close();
      } catch (error) {
        if (isInsufficientCreditsError(error)) {
          emit(
            sseEvent("error", {
              message: "Not enough credits. Top up in Billing.",
              code: "insufficient_credits",
            }),
          );
        } else {
          logger.error("boardroom.stream.failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          emit(
            sseEvent("error", {
              message: "The boardroom hit an error. Try again in a moment.",
            }),
          );
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
