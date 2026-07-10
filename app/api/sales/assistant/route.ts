import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { resolveAgentContext } from "@/lib/ai/context";
import { buildSalesSnapshot } from "@/lib/ai/context/sales";
import {
  buildFreeClarifierReply,
  shouldChargeAssistantTurn,
  shouldUseFreeClarifierTemplate,
} from "@/lib/ai/assistant-clarifier";
import { spendCredits, isInsufficientCreditsError } from "@/lib/ai/credits";
import { buildSalesAssistantRules } from "@/lib/ai/sales-assistant-prompt";
import {
  SALES_ASSISTANT_TOOLS,
  executeSalesAssistantTool,
  isSalesActionTool,
  malaysiaTodayIso,
} from "@/lib/ai/sales-assistant-tools";
import { buildSmartSalesClarifier } from "@/lib/ai/sales-smart-clarifier";
import {
  extractChatAssistantText,
  openaiChat,
  type AgentChatMessage,
  type ChatCompletionResponse,
} from "@/lib/ai/openai";
import { resolveAgentModel } from "@/lib/settings/ai-agents-catalog";
import { recordAiUsage } from "@/lib/ai/usage";
import { canUseLeads } from "@/lib/sales/access";
import { SALES_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import {
  actionTopUpCreditsForReasoning,
  chatCreditsForReasoning,
} from "@/lib/settings/reasoning-credits";
import {
  getCreditBalance,
  hasSalesAssistantAddon,
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

const sufiAssistantSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

async function requireSalesUser() {
  try {
    const user = await getCurrentUser();
    if (!canUseLeads(user.role)) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "forbidden", reason: "sales leads access denied" },
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

async function runSufiAssistantChat(
  ctx: Awaited<ReturnType<typeof resolveAgentContext>>,
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  displayName: string,
  businessName: string | null,
  settings: Awaited<ReturnType<typeof loadBusinessAgentSettings>>,
  salesPacketText: string,
): Promise<ChatRunResult> {
  const model = resolveAgentModel({
    reasoningMode: settings.reasoningMode,
    modelOverride: settings.modelOverride,
  });
  const baseMessages: AgentChatMessage[] = [
    {
      role: "system",
      content:
        buildSalesAssistantRules({
          displayName,
          businessName: businessName ?? undefined,
          todayIso: malaysiaTodayIso(),
        }) +
        "\n\nDATA PACKET — SALES (leads + POS today):\n" +
        salesPacketText,
    },
    ...history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user", content: userMessage },
  ];

  let completion = await openaiChat<ChatCompletionResponse>({
    model,
    briefingFor: "sales",
    context: ctx,
    temperature: 0.2,
    messages: baseMessages,
    tools: SALES_ASSISTANT_TOOLS,
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

    if (isSalesActionTool(toolCall.function.name)) {
      usedActionTool = true;
    }

    const result = await executeSalesAssistantTool(
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
  const { user, response } = await requireSalesUser();
  if (response) return response;

  const [addonActive, settings, balance, recentTurns] = await Promise.all([
    hasSalesAssistantAddon(user.businessId),
    loadBusinessAgentSettings(user.businessId, SALES_AGENT_SLUG),
    getCreditBalance(user.businessId),
    loadShortMemory({
      businessId: user.businessId,
      userId: user.id,
      agentSlug: SALES_AGENT_SLUG,
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
  const { user, response } = await requireSalesUser();
  if (response) return response;

  await clearShortMemory({
    businessId: user.businessId,
    userId: user.id,
    agentSlug: SALES_AGENT_SLUG,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST(request: Request) {
  const { user, response } = await requireSalesUser();
  if (response) return response;

  const rl = consume({
    bucket: "sales.assistant.chat",
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
    parsed = sufiAssistantSchema.parse(body);
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
    salesSnapshot,
  ] = await Promise.all([
    hasSalesAssistantAddon(ctx.businessId),
    loadBusinessAgentSettings(ctx.businessId, SALES_AGENT_SLUG),
    getAgentCreditsSpentToday(ctx.businessId, SALES_AGENT_SLUG),
    supabase
      .from("businesses")
      .select("name")
      .eq("id", ctx.businessId)
      .single(),
    getCreditBalance(ctx.businessId),
    loadShortMemory({
      businessId: ctx.businessId,
      userId: user.id,
      agentSlug: SALES_AGENT_SLUG,
    }),
    buildSalesSnapshot(ctx),
  ]);

  if (!addonActive) {
    return NextResponse.json(
      {
        error: "addon_required",
        message: "Subscribe to Sales AI (Sufi) in the Marketplace to chat.",
        marketplace_href: "/marketplace",
      },
      { status: 403 },
    );
  }

  if (!settings.assistantEnabled) {
    return NextResponse.json(
      {
        error: "assistant_disabled",
        message: "Sufi is turned off in Settings → AI Agents.",
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

  const business = businessRes.data;
  const chatCost = chatCreditsForReasoning(settings.reasoningMode);
  const actionTopUp = actionTopUpCreditsForReasoning(settings.reasoningMode);
  const model = resolveAgentModel({
    reasoningMode: settings.reasoningMode,
    modelOverride: settings.modelOverride,
  });

  // Free clarifying questions (smart model, template fallback) — no credits.
  if (
    shouldUseFreeClarifierTemplate("sales", parsed.message, historyForModel)
  ) {
    const smart = await buildSmartSalesClarifier({
      displayName: settings.displayName,
      userMessage: parsed.message,
      snapshot: salesSnapshot,
      model,
    });
    const reply =
      smart.reply ||
      buildFreeClarifierReply("sales", settings.displayName, parsed.message);

    try {
      await saveShortMemory({
        businessId: ctx.businessId,
        userId: user.id,
        agentSlug: SALES_AGENT_SLUG,
        turns: [
          ...historyForModel,
          { role: "user", content: parsed.message },
          { role: "assistant", content: reply },
        ],
      });
    } catch (memoryError) {
      logger.warn("sales.assistant.short_memory_failed", {
        businessId: ctx.businessId,
        error:
          memoryError instanceof Error
            ? memoryError.message
            : String(memoryError),
      });
    }

    await recordAiUsage({
      businessId: ctx.businessId,
      triggerType: "CHAT",
      creditsCharged: 0,
      mode: "fast",
      costMyrEstimated: 0,
      agentSlug: SALES_AGENT_SLUG,
      metadata: {
        free_clarifier: true,
        smart_clarifier: smart.usedModel,
        reasoning_mode: settings.reasoningMode,
      },
    });

    return NextResponse.json(
      {
        reply,
        credits: {
          charged: 0,
          balance: creditBalance,
          mode: "fast" as const,
          free_clarifier: true,
        },
      },
      { status: 200 },
    );
  }

  if (creditBalance < chatCost) {
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

  const salesPacketText = [
    salesSnapshot.headline,
    salesSnapshot.notes ?? "",
    ...salesSnapshot.kpis.map((k) => `${k.label}: ${k.value}${k.unit ? ` ${k.unit}` : ""}`),
    ...salesSnapshot.attention.map((a) => `Attention: ${a.label}`),
    ...salesSnapshot.recent.map((r) => `${r.label}${r.meta ? ` — ${r.meta}` : ""}`),
  ].join("\n");

  let totalCharged = 0;

  try {
    const { reply, usedActionTool } = await runSufiAssistantChat(
      ctx,
      parsed.message,
      historyForModel,
      settings.displayName,
      business?.name ?? null,
      settings,
      salesPacketText,
    );

    try {
      await saveShortMemory({
        businessId: ctx.businessId,
        userId: user.id,
        agentSlug: SALES_AGENT_SLUG,
        turns: [
          ...historyForModel,
          { role: "user", content: parsed.message },
          { role: "assistant", content: reply },
        ],
      });
    } catch (memoryError) {
      logger.warn("sales.assistant.short_memory_failed", {
        businessId: ctx.businessId,
        error:
          memoryError instanceof Error
            ? memoryError.message
            : String(memoryError),
      });
    }

    const billable = shouldChargeAssistantTurn({ usedActionTool, reply });

    if (billable) {
      const firstSpend = await spendCredits(ctx, {
        amount: chatCost,
        reason: "sales.assistant.chat",
      });
      totalCharged += firstSpend.charged;

      if (usedActionTool) {
        try {
          const actionSpend = await spendCredits(ctx, {
            amount: actionTopUp,
            reason: "sales.assistant.action",
          });
          totalCharged += actionSpend.charged;
        } catch (actionError) {
          if (!isInsufficientCreditsError(actionError)) {
            throw actionError;
          }
          logger.warn("sales.assistant.action_credit_shortfall", {
            businessId: ctx.businessId,
          });
        }
      }
    }

    const balance = await getCreditBalance(ctx.businessId);

    await recordAiUsage({
      businessId: ctx.businessId,
      triggerType: usedActionTool ? "ACTION" : "CHAT",
      creditsCharged: totalCharged,
      mode: "fast",
      costMyrEstimated: creditsToMyr(totalCharged),
      agentSlug: SALES_AGENT_SLUG,
      metadata: {
        used_action_tool: usedActionTool,
        free_clarifier: !billable,
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
          free_clarifier: !billable,
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
    logger.error("sales.assistant.failed", {
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
          ? "Sufi needs ILMU or OpenAI configured on the platform (Super Admin → Integrations, or ILMU_API_KEY on Vercel)."
          : "Sufi hit a server error. Try again in a moment — your credits and settings are fine.",
      },
      { status: 503 },
    );
  }
}
