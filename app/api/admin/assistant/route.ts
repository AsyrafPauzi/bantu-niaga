import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { resolveAgentContext } from "@/lib/ai/context";
import { buildAdminSnapshot } from "@/lib/ai/context/admin";
import {
  buildFreeClarifierReply,
  shouldChargeAssistantTurn,
  shouldUseFreeClarifierTemplate,
} from "@/lib/ai/assistant-clarifier";
import { spendCredits, isInsufficientCreditsError } from "@/lib/ai/credits";
import { buildAdminAssistantRules } from "@/lib/ai/admin-assistant-prompt";
import {
  composeStaffAgentSystemPrompt,
  loadPublishedAgentScope,
} from "@/lib/ai/agent-scope-runtime";
import { STAFF_ASSISTANT_MAX_TOKENS } from "@/lib/ai/staff-assistant-shared";
import {
  detectUserLanguage,
  userLanguageInstruction,
} from "@/lib/ai/user-language";
import {
  extractChatAssistantText,
  openaiChat,
  type AgentChatMessage,
  type ChatCompletionResponse,
} from "@/lib/ai/openai";
import { resolveAgentModel } from "@/lib/settings/ai-agents-catalog";
import { recordAiUsage } from "@/lib/ai/usage";
import { canUseAdminAssistant } from "@/lib/admin/access";
import { ADMIN_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { chatCreditsForReasoning } from "@/lib/settings/reasoning-credits";
import {
  getCreditBalance,
  hasAdminAssistantAddon,
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
import { malaysiaTodayYmd } from "@/lib/sales/schemas";
import type { PillarSnapshot } from "@/lib/ai/context/types";

export const dynamic = "force-dynamic";

const adminAssistantSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

function formatSnapshotPacket(snapshot: PillarSnapshot): string {
  return [
    snapshot.headline,
    snapshot.notes ?? "",
    ...snapshot.kpis.map(
      (k) => `${k.label}: ${k.value}${k.unit ? ` ${k.unit}` : ""}`,
    ),
    ...snapshot.attention.map((a) => `Attention: ${a.label}`),
    ...snapshot.recent.map(
      (r) => `${r.label}${r.meta ? ` — ${r.meta}` : ""}`,
    ),
  ].join("\n");
}

async function requireAdminUser() {
  try {
    const user = await getCurrentUser();
    if (!canUseAdminAssistant(user.role)) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "forbidden", reason: "admin assistant access denied" },
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

async function runAdminAssistantChat(
  ctx: Awaited<ReturnType<typeof resolveAgentContext>>,
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  displayName: string,
  businessName: string | null,
  settings: Awaited<ReturnType<typeof loadBusinessAgentSettings>>,
  adminPacketText: string,
): Promise<string> {
  const model = resolveAgentModel({
    reasoningMode: settings.reasoningMode,
    modelOverride: settings.modelOverride,
  });
  const lang = detectUserLanguage(userMessage);
  const scope = await loadPublishedAgentScope(ADMIN_AGENT_SLUG);
  const systemContent = composeStaffAgentSystemPrompt({
    scope,
    fallbackRules: buildAdminAssistantRules({
      displayName,
      businessName: businessName ?? undefined,
      todayIso: malaysiaTodayYmd(),
      userLanguageInstruction: userLanguageInstruction(lang),
    }),
    displayName,
    businessName: businessName ?? undefined,
    todayIso: malaysiaTodayYmd(),
    roleLabel: "Admin",
    dataPacketLabel: "DATA PACKET — ADMIN (tasks + compliance + storage):",
    dataPacketText: adminPacketText,
    extraBlocks: scope?.systemPrompt
      ? [userLanguageInstruction(lang)].filter(Boolean)
      : undefined,
  });
  const messages: AgentChatMessage[] = [
    {
      role: "system",
      content: systemContent,
    },
    ...history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user", content: userMessage },
  ];

  const completion = await openaiChat<ChatCompletionResponse>({
    model,
    briefingFor: "admin",
    context: ctx,
    temperature: 0.2,
    max_tokens: STAFF_ASSISTANT_MAX_TOKENS,
    messages,
    tool_choice: "none",
  });

  return extractChatAssistantText(completion);
}

export async function GET() {
  const { user, response } = await requireAdminUser();
  if (response) return response;

  const [addonActive, settings, balance, recentTurns] = await Promise.all([
    hasAdminAssistantAddon(user.businessId),
    loadBusinessAgentSettings(user.businessId, ADMIN_AGENT_SLUG),
    getCreditBalance(user.businessId),
    loadShortMemory({
      businessId: user.businessId,
      userId: user.id,
      agentSlug: ADMIN_AGENT_SLUG,
    }),
  ]);

  return NextResponse.json({
    addon_active: addonActive,
    assistant_enabled: settings.assistantEnabled,
    display_name: settings.displayName,
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
  const { user, response } = await requireAdminUser();
  if (response) return response;

  await clearShortMemory({
    businessId: user.businessId,
    userId: user.id,
    agentSlug: ADMIN_AGENT_SLUG,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST(request: Request) {
  const { user, response } = await requireAdminUser();
  if (response) return response;

  const rl = consume({
    bucket: "admin.assistant.chat",
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
    parsed = adminAssistantSchema.parse(body);
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
    adminSnapshot,
  ] = await Promise.all([
    hasAdminAssistantAddon(ctx.businessId),
    loadBusinessAgentSettings(ctx.businessId, ADMIN_AGENT_SLUG),
    getAgentCreditsSpentToday(ctx.businessId, ADMIN_AGENT_SLUG),
    supabase
      .from("businesses")
      .select("name")
      .eq("id", ctx.businessId)
      .single(),
    getCreditBalance(ctx.businessId),
    loadShortMemory({
      businessId: ctx.businessId,
      userId: user.id,
      agentSlug: ADMIN_AGENT_SLUG,
    }),
    buildAdminSnapshot(ctx),
  ]);

  if (!addonActive) {
    return NextResponse.json(
      {
        error: "addon_required",
        message: "Subscribe to Admin AI (Amir) in the Marketplace to chat.",
        marketplace_href: "/marketplace",
      },
      { status: 403 },
    );
  }

  if (!settings.assistantEnabled) {
    return NextResponse.json(
      {
        error: "assistant_disabled",
        message: "Amir is turned off in Settings → AI Agents.",
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
  const adminPacketText = formatSnapshotPacket(adminSnapshot);

  if (
    shouldUseFreeClarifierTemplate("admin", parsed.message, historyForModel)
  ) {
    const reply = buildFreeClarifierReply(
      "admin",
      settings.displayName,
      parsed.message,
    );

    try {
      await saveShortMemory({
        businessId: ctx.businessId,
        userId: user.id,
        agentSlug: ADMIN_AGENT_SLUG,
        turns: [
          ...historyForModel,
          { role: "user", content: parsed.message },
          { role: "assistant", content: reply },
        ],
      });
    } catch (memoryError) {
      logger.warn("admin.assistant.short_memory_failed", {
        businessId: ctx.businessId,
        error:
          memoryError instanceof Error
            ? memoryError.message
            : String(memoryError),
      });
    }

    await recordAiUsage({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      triggerType: "CHAT",
      creditsCharged: 0,
      mode: "fast",
      costMyrEstimated: 0,
      agentSlug: ADMIN_AGENT_SLUG,
      metadata: {
        free_clarifier: true,
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

  let totalCharged = 0;

  try {
    const reply = await runAdminAssistantChat(
      ctx,
      parsed.message,
      historyForModel,
      settings.displayName,
      business?.name ?? null,
      settings,
      adminPacketText,
    );

    try {
      await saveShortMemory({
        businessId: ctx.businessId,
        userId: user.id,
        agentSlug: ADMIN_AGENT_SLUG,
        turns: [
          ...historyForModel,
          { role: "user", content: parsed.message },
          { role: "assistant", content: reply },
        ],
      });
    } catch (memoryError) {
      logger.warn("admin.assistant.short_memory_failed", {
        businessId: ctx.businessId,
        error:
          memoryError instanceof Error
            ? memoryError.message
            : String(memoryError),
      });
    }

    const billable = shouldChargeAssistantTurn({
      usedActionTool: false,
      reply,
    });

    if (billable) {
      const spend = await spendCredits(ctx, {
        amount: chatCost,
        reason: "admin.assistant.chat",
      });
      totalCharged += spend.charged;
    }

    const balance = await getCreditBalance(ctx.businessId);

    await recordAiUsage({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      triggerType: "CHAT",
      creditsCharged: totalCharged,
      mode: "fast",
      costMyrEstimated: creditsToMyr(totalCharged),
      agentSlug: ADMIN_AGENT_SLUG,
      metadata: {
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
    logger.error("admin.assistant.failed", {
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
          ? "Amir needs ILMU or OpenAI configured on the platform (Super Admin → Integrations, or ILMU_API_KEY on Vercel)."
          : "Amir hit a server error. Try again in a moment — your credits and settings are fine.",
      },
      { status: 503 },
    );
  }
}
