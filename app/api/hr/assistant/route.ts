import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { resolveAgentContext } from "@/lib/ai/context";
import { spendCredits, isInsufficientCreditsError } from "@/lib/ai/credits";
import { buildHrAssistantRules } from "@/lib/ai/hr-assistant-prompt";
import {
  HR_ASSISTANT_TOOLS,
  executeHrAssistantTool,
  isHrActionTool,
  malaysiaTodayIso,
} from "@/lib/ai/hr-assistant-tools";
import {
  extractChatAssistantText,
  openaiChat,
  type AgentChatMessage,
  type ChatCompletionResponse,
} from "@/lib/ai/openai";
import {
  resolveAgentModel,
} from "@/lib/settings/ai-agents-catalog";
import { recordAiUsage } from "@/lib/ai/usage";
import { canManageHrCore } from "@/lib/hr/access";
import {
  HR_AGENT_SLUG,
} from "@/lib/marketplace/agent-types";
import {
  actionTopUpCreditsForReasoning,
  chatCreditsForReasoning,
} from "@/lib/settings/reasoning-credits";
import {
  getCreditBalance,
  hasHrAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { creditsToMyr } from "@/lib/settings/credit-pricing";
import { getAgentCreditsSpentToday } from "@/lib/settings/ai-agents";
import { logger } from "@/lib/logger";
import {
  clearShortMemory,
  loadShortMemory,
  saveShortMemory,
} from "@/lib/ai/short-memory";
import { consume, rateLimitHeaders } from "@/lib/api/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const hrAssistantSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

async function requireHrUser() {
  try {
    const user = await getCurrentUser();
    if (!canManageHrCore(user.role)) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "forbidden", reason: "hr access denied" },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "unauthorized", code: error.code },
          { status: 401 },
        ),
      };
    }
    throw error;
  }
}

interface ChatRunResult {
  reply: string;
  usedActionTool: boolean;
}

async function runHrAssistantChat(
  ctx: Awaited<ReturnType<typeof resolveAgentContext>>,
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  displayName: string,
  businessName: string | null,
  settings: Awaited<ReturnType<typeof loadBusinessAgentSettings>>,
): Promise<ChatRunResult> {
  const model = resolveAgentModel({
    reasoningMode: settings.reasoningMode,
    modelOverride: settings.modelOverride,
  });
  const baseMessages: AgentChatMessage[] = [
    {
      role: "system",
      content: buildHrAssistantRules({
        displayName,
        businessName: businessName ?? undefined,
        todayIso: malaysiaTodayIso(),
      }),
    },
    ...history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user", content: userMessage },
  ];

  let completion = await openaiChat<ChatCompletionResponse>({
    model,
    briefingFor: "hr",
    context: ctx,
    temperature: 0.2,
    messages: baseMessages,
    tools: HR_ASSISTANT_TOOLS,
    tool_choice: "auto",
  });

  const assistantMessage = completion.choices?.[0]?.message;
  const toolCalls = assistantMessage?.tool_calls ?? [];

  if (toolCalls.length === 0) {
    return {
      reply: extractChatAssistantText(completion),
      usedActionTool: false,
    };
  }

  const followUpMessages: AgentChatMessage[] = [
    ...baseMessages,
    {
      role: "assistant",
      content: assistantMessage?.content ?? null,
      tool_calls: toolCalls,
    },
  ];

  let usedActionTool = false;
  for (const toolCall of toolCalls) {
    let parsedArgs: unknown = {};
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
    } catch {
      parsedArgs = {};
    }

    if (isHrActionTool(toolCall.function.name)) {
      usedActionTool = true;
    }

    const result = await executeHrAssistantTool(
      ctx,
      toolCall.function.name,
      parsedArgs,
    );

    followUpMessages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify(result),
    });
  }

  completion = await openaiChat<ChatCompletionResponse>({
    model,
    context: ctx,
    temperature: 0.2,
    messages: followUpMessages,
    includeBriefing: false,
    tool_choice: "none",
  });

  return {
    reply: extractChatAssistantText(completion),
    usedActionTool,
  };
}

export async function GET() {
  const { user, response } = await requireHrUser();
  if (response) return response;

  const [addonActive, settings, balance, recentTurns] = await Promise.all([
    hasHrAssistantAddon(user.businessId),
    loadBusinessAgentSettings(user.businessId),
    getCreditBalance(user.businessId),
    loadShortMemory({
      businessId: user.businessId,
      userId: user.id,
      agentSlug: HR_AGENT_SLUG,
    }),
  ]);

  return NextResponse.json({
    addon_active: addonActive,
    assistant_enabled: settings.assistantEnabled,
    display_name: settings.displayName,
    daily_notice_enabled: settings.dailyNoticeEnabled,
    reasoning_mode: settings.reasoningMode,
    credit_cost_chat: chatCreditsForReasoning(settings.reasoningMode),
    credit_balance: balance,
    credits_paused:
      balance < chatCreditsForReasoning(settings.reasoningMode),
    business_id: user.businessId,
    recent_turns: recentTurns,
  });
}

export async function DELETE() {
  const { user, response } = await requireHrUser();
  if (response) return response;

  await clearShortMemory({
    businessId: user.businessId,
    userId: user.id,
    agentSlug: HR_AGENT_SLUG,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST(request: Request) {
  const { user, response } = await requireHrUser();
  if (response) return response;

  const rl = consume({
    bucket: "hr.assistant.chat",
    identifier: `user:${user.id}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many messages. Pause a moment and try again.",
        retry_after_seconds: rl.retryAfterSeconds,
      },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = hrAssistantSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  const ctx = await resolveAgentContext();

  const supabase = await createSupabaseServerClient();
  const [
    addonActive,
    settings,
    spentTodayCredits,
    businessRes,
    creditBalance,
    historyForModel,
  ] = await Promise.all([
    hasHrAssistantAddon(ctx.businessId),
    loadBusinessAgentSettings(ctx.businessId),
    getAgentCreditsSpentToday(ctx.businessId, HR_AGENT_SLUG),
    supabase
      .from("businesses")
      .select("name")
      .eq("id", ctx.businessId)
      .single(),
    getCreditBalance(ctx.businessId),
    loadShortMemory({
      businessId: ctx.businessId,
      userId: user.id,
      agentSlug: HR_AGENT_SLUG,
    }),
  ]);

  if (!addonActive) {
    return NextResponse.json(
      {
        error: "addon_required",
        message: "Subscribe to HR Assistant (Hana) in the Marketplace to chat.",
        marketplace_href: "/marketplace",
      },
      { status: 403 },
    );
  }

  if (!settings.assistantEnabled) {
    return NextResponse.json(
      {
        error: "assistant_disabled",
        message: "HR Assistant is turned off in Settings → AI Agents.",
      },
      { status: 403 },
    );
  }

  if (spentTodayCredits >= settings.dailyBudgetCredits) {
    return NextResponse.json(
      {
        error: "daily_budget_exceeded",
        message: `Daily budget reached (${settings.dailyBudgetCredits} credits · RM ${creditsToMyr(settings.dailyBudgetCredits).toFixed(2)}). Increase the budget in Settings → AI Agents or try again tomorrow.`,
      },
      { status: 429 },
    );
  }

  if (creditBalance < chatCreditsForReasoning(settings.reasoningMode)) {
    return NextResponse.json(
      {
        error: "insufficient_credits",
        message:
          "No credits left in your shared pool. Top up in Billing or wait for your monthly refill.",
        credit_balance: creditBalance,
        billing_href: "/settings/billing",
      },
      { status: 402 },
    );
  }

  const business = businessRes.data;

  let totalCharged = 0;

  const chatCost = chatCreditsForReasoning(settings.reasoningMode);
  const actionTopUp = actionTopUpCreditsForReasoning(settings.reasoningMode);

  try {
    const firstSpend = await spendCredits(ctx, {
      amount: chatCost,
      reason: "hr.assistant.chat",
    });
    totalCharged += firstSpend.charged;

    const { reply, usedActionTool } = await runHrAssistantChat(
      ctx,
      parsed.message,
      historyForModel,
      settings.displayName,
      business?.name ?? null,
      settings,
    );

    try {
      await saveShortMemory({
        businessId: ctx.businessId,
        userId: user.id,
        agentSlug: HR_AGENT_SLUG,
        turns: [
          ...historyForModel,
          { role: "user", content: parsed.message },
          { role: "assistant", content: reply },
        ],
      });
    } catch (memoryError) {
      logger.warn("hr.assistant.short_memory_failed", {
        businessId: ctx.businessId,
        error:
          memoryError instanceof Error
            ? memoryError.message
            : String(memoryError),
      });
    }

    if (usedActionTool) {
      try {
        const actionSpend = await spendCredits(ctx, {
          amount: actionTopUp,
          reason: "hr.assistant.action",
        });
        totalCharged += actionSpend.charged;
      } catch (actionError) {
        if (!isInsufficientCreditsError(actionError)) {
          throw actionError;
        }
        logger.warn("hr.assistant.action_credit_shortfall", {
          businessId: ctx.businessId,
        });
      }
    }

    const balance = await getCreditBalance(ctx.businessId);

    await recordAiUsage({
      businessId: ctx.businessId,
      triggerType: usedActionTool ? "ACTION" : "CHAT",
      creditsCharged: totalCharged,
      mode: "fast",
      costMyrEstimated: creditsToMyr(totalCharged),
      agentSlug: HR_AGENT_SLUG,
      metadata: {
        used_action_tool: usedActionTool,
        reasoning_mode: settings.reasoningMode,
      },
    });

    return NextResponse.json(
      {
        reply,
        credits: {
          charged: totalCharged,
          balance,
          mode: "fast" as const,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      const balance = await getCreditBalance(ctx.businessId);
      return NextResponse.json(
        {
          error: "insufficient_credits",
          message:
            "No credits left in your shared pool. Top up in Billing or wait for your monthly refill.",
          credit_balance: balance,
          billing_href: "/settings/billing",
        },
        { status: 402 },
      );
    }

    const detail = error instanceof Error ? error.message : String(error);
    logger.error("hr.assistant.failed", {
      businessId: ctx.businessId,
      error: detail,
    });

    const noProvider =
      detail.includes("No AI provider configured") ||
      detail.includes("ILMU_API_KEY") ||
      detail.includes("OPENAI_API_KEY");

    return NextResponse.json(
      {
        error: noProvider ? "ai_provider_missing" : "assistant_unavailable",
        message: noProvider
          ? "The HR assistant needs ILMU or OpenAI configured on the platform (Super Admin → Integrations, or ILMU_API_KEY on Vercel)."
          : "The HR assistant hit a server error. Try again in a moment — your credits and settings are fine.",
      },
      { status: 503 },
    );
  }
}
