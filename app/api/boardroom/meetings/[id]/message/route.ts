import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  executeBoardroomPendingActions,
  isBoardroomCreateConfirm,
  type BoardroomPendingAction,
} from "@/lib/ai/boardroom-actions";
import { resolveAgentContext } from "@/lib/ai/context";
import { canManageBoardroom } from "@/lib/ai/boardroom-access";
import {
  runBoardroomUserTurn,
  type AgentDecision,
} from "@/lib/ai/boardroom-orchestrator";
import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";
import { getCreditBalance } from "@/lib/marketplace/entitlements";
import { loadBusinessAgentSettings } from "@/lib/marketplace/entitlements";
import { logger } from "@/lib/logger";
import { consume, rateLimitHeaders } from "@/lib/api/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isInsufficientCreditsError } from "@/lib/ai/credits";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

const messageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
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

/** POST /api/boardroom/meetings/[id]/message */
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
    parsed = messageSchema.parse(body);
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
      "id, status, invited_agent_ids, awaiting_clarifiers, pending_decisions, pending_actions, credits_spent",
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

  const balance = await getCreditBalance(user.businessId);
  const answeringClarifiers = meeting.awaiting_clarifiers === true;

  // Need at least 1 credit if we might speak (skip check when only clarifying)
  if (!answeringClarifiers && balance < 1) {
    // Still allow — clarifier path is free; speak path may fail mid-way
  }

  await supabase.from("boardroom_messages").insert({
    business_id: user.businessId,
    meeting_id: id,
    role: "user",
    content: parsed.message,
  });

  const pendingActions = (meeting.pending_actions ??
    []) as BoardroomPendingAction[];

  if (
    !answeringClarifiers &&
    pendingActions.length > 0 &&
    isBoardroomCreateConfirm(parsed.message)
  ) {
    try {
      const ctx = await resolveAgentContext();
      const lines = await executeBoardroomPendingActions({
        ctx,
        actions: pendingActions,
      });
      const content =
        lines.length > 0
          ? `Created:\n${lines.map((l) => `· ${l}`).join("\n")}`
          : "Nothing was created. Ask again with clearer details.";

      await supabase.from("boardroom_messages").insert({
        business_id: user.businessId,
        meeting_id: id,
        role: "system",
        content,
        meta: { create_confirm: true },
      });

      await supabase
        .from("boardroom_meetings")
        .update({ pending_actions: null })
        .eq("id", id)
        .eq("business_id", user.businessId);

      const { data: messages } = await supabase
        .from("boardroom_messages")
        .select("id, role, agent_id, content, meta, created_at")
        .eq("meeting_id", id)
        .eq("business_id", user.businessId)
        .order("created_at", { ascending: true });

      return NextResponse.json({
        awaiting_clarifiers: false,
        credits_charged: 0,
        credit_balance: await getCreditBalance(user.businessId),
        messages: messages ?? [],
        created: true,
      });
    } catch (error) {
      logger.error("boardroom.create_confirm.failed", {
        businessId: user.businessId,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        {
          error: "create_failed",
          message: "Could not create drafts. Try again or use Maya/Sufi chat.",
        },
        { status: 503 },
      );
    }
  }

  const invited = (meeting.invited_agent_ids ?? []) as BoardroomAgentId[];
  const displayNames: Record<string, string> = {};
  await Promise.all(
    invited.map(async (agentId) => {
      const settings = await loadBusinessAgentSettings(
        user.businessId,
        agentId,
      );
      displayNames[agentId] = settings.displayName;
    }),
  );

  let turnMessage = parsed.message;

  if (answeringClarifiers) {
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
    turnMessage = original
      ? `Original question:\n${original}\n\nOwner clarifier answers:\n${parsed.message}`
      : parsed.message;
  }

  const priorDecisions = answeringClarifiers
    ? ((meeting.pending_decisions as AgentDecision[] | null) ?? undefined)
    : undefined;

  try {
    const ctx = await resolveAgentContext();
    const result = await runBoardroomUserTurn({
      ctx,
      invited,
      userMessage: turnMessage,
      answeringClarifiers,
      priorDecisions,
      displayNames,
    });

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
        business_id: user.businessId,
        meeting_id: id,
        role: "room_clarifier",
        content: result.clarifierContent,
        meta: { free: true },
      });
    }

    for (const reply of result.agentReplies) {
      newMessages.push({
        business_id: user.businessId,
        meeting_id: id,
        role: "agent",
        agent_id: reply.agentId,
        content: reply.content,
        meta: { credits: 1 },
      });
    }

    if (result.synthContent) {
      newMessages.push({
        business_id: user.businessId,
        meeting_id: id,
        role: "synth",
        content: result.synthContent,
        meta: { free: true },
      });
    }

    if (newMessages.length > 0) {
      await supabase.from("boardroom_messages").insert(newMessages);
    }

    const patch: Record<string, unknown> = {
      awaiting_clarifiers: result.awaitingClarifiers,
      credits_spent:
        Number(meeting.credits_spent ?? 0) + result.creditsCharged,
      pending_decisions: result.awaitingClarifiers ? result.decisions : null,
      pending_actions:
        result.pendingActions.length > 0 ? result.pendingActions : null,
    };

    await supabase
      .from("boardroom_meetings")
      .update(patch)
      .eq("id", id)
      .eq("business_id", user.businessId);

    const { data: messages } = await supabase
      .from("boardroom_messages")
      .select("id, role, agent_id, content, meta, created_at")
      .eq("meeting_id", id)
      .eq("business_id", user.businessId)
      .order("created_at", { ascending: true });

    const newBalance = await getCreditBalance(user.businessId);

    return NextResponse.json({
      awaiting_clarifiers: result.awaitingClarifiers,
      credits_charged: result.creditsCharged,
      credit_balance: newBalance,
      messages: messages ?? [],
    });
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          message: "Not enough credits for agents to speak. Top up in Billing.",
          billing_href: "/settings/billing",
        },
        { status: 402 },
      );
    }
    logger.error("boardroom.message.failed", {
      businessId: user.businessId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: "boardroom_unavailable",
        message: "The boardroom hit an error. Try again in a moment.",
      },
      { status: 503 },
    );
  }
}
