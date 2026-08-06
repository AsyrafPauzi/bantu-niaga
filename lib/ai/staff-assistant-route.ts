import "server-only";

import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import type { CurrentUser } from "@/lib/auth/current-user";
import { resolveAgentContext } from "@/lib/ai/context";
import {
  buildFreeClarifierReply,
  shouldChargeAssistantTurn,
  shouldUseFreeClarifierTemplate,
  type StaffAssistantKind,
} from "@/lib/ai/assistant-clarifier";
import { spendCredits, isInsufficientCreditsError } from "@/lib/ai/credits";
import {
  actionTopUpCreditsForReasoning,
  chatCreditsForReasoning,
} from "@/lib/settings/reasoning-credits";
import type { BusinessAgentSettings } from "@/lib/marketplace/agent-types";
import {
  getCreditBalance,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { creditsToMyr } from "@/lib/settings/credit-pricing";
import { getAgentCreditsSpentToday } from "@/lib/settings/ai-agents";
import { logger } from "@/lib/logger";
import {
  clearShortMemory,
  loadShortMemory,
  saveShortMemory,
  type ShortMemoryTurn,
} from "@/lib/ai/short-memory";
import { enforceRateLimit } from "@/lib/api/enforce-rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordAiUsage } from "@/lib/ai/usage";

const messageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export type StaffAssistantRequireUser = () => Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
>;

export interface StaffAssistantChatArgs {
  ctx: Awaited<ReturnType<typeof resolveAgentContext>>;
  message: string;
  history: ShortMemoryTurn[];
  displayName: string;
  businessName: string | null;
  settings: BusinessAgentSettings;
  user: CurrentUser;
  extras: unknown;
}

export interface StaffAssistantPostContext {
  ctx: Awaited<ReturnType<typeof resolveAgentContext>>;
  message: string;
  history: ShortMemoryTurn[];
  settings: BusinessAgentSettings;
  user: CurrentUser;
  extras: unknown;
  creditBalance: number;
}

export interface StaffAssistantEarlyReply {
  reply: string;
  metadata?: Record<string, unknown>;
  freeClarifier?: boolean;
  outOfScope?: boolean;
}

export interface StaffAssistantRouteConfig {
  agentSlug: string;
  clarifierKind: StaffAssistantKind;
  rateLimitBucket: string;
  logKey: string;
  addonRequiredMessage: string;
  assistantDisabledMessage: string;
  providerMissingMessage: string;
  unavailableMessage: string;
  requireUser: StaffAssistantRequireUser;
  hasAddon: (businessId: string) => Promise<boolean>;
  includeDailyNoticeInGet?: boolean;
  chargeActionTopUp?: boolean;
  loadPostExtras?: (
    ctx: Awaited<ReturnType<typeof resolveAgentContext>>,
  ) => Promise<unknown>;
  runChat: (
    args: StaffAssistantChatArgs,
  ) => Promise<{ reply: string; usedActionTool: boolean }>;
  /** Sales smart clarifier — overrides template when free clarifier triggers. */
  resolveClarifierReply?: (
    args: StaffAssistantPostContext,
  ) => Promise<string>;
  /** Operations out-of-scope redirect — runs after clarifier, before billing. */
  tryEarlyReply?: (
    args: StaffAssistantPostContext,
  ) => Promise<StaffAssistantEarlyReply | null>;
}

export function createStaffAssistantRouteHandlers(
  config: StaffAssistantRouteConfig,
) {
  const chargeActionTopUp = config.chargeActionTopUp ?? true;

  async function finishEarlyReply(
    post: StaffAssistantPostContext,
    early: StaffAssistantEarlyReply,
  ): Promise<NextResponse> {
    try {
      await saveShortMemory({
        businessId: post.ctx.businessId,
        userId: post.user.id,
        agentSlug: config.agentSlug,
        turns: [
          ...post.history,
          { role: "user", content: post.message },
          { role: "assistant", content: early.reply },
        ],
      });
    } catch (memoryError) {
      logger.warn(`${config.logKey}.short_memory_failed`, {
        businessId: post.ctx.businessId,
        error:
          memoryError instanceof Error
            ? memoryError.message
            : String(memoryError),
      });
    }

    await recordAiUsage({
      businessId: post.ctx.businessId,
      actorUserId: post.ctx.userId,
      triggerType: "CHAT",
      creditsCharged: 0,
      mode: "fast",
      costMyrEstimated: 0,
      agentSlug: config.agentSlug,
      metadata: {
        ...(early.freeClarifier ? { free_clarifier: true } : {}),
        ...(early.outOfScope ? { out_of_scope_redirect: early.metadata?.pillar } : {}),
        reasoning_mode: post.settings.reasoningMode,
        ...early.metadata,
      },
    });

    return NextResponse.json(
      {
        reply: early.reply,
        credits: {
          charged: 0,
          balance: post.creditBalance,
          mode: "fast" as const,
          ...(early.freeClarifier ? { free_clarifier: true } : {}),
          ...(early.outOfScope ? { out_of_scope: true } : {}),
        },
      },
      { status: 200 },
    );
  }

  async function GET() {
    const auth = await config.requireUser();
    if (auth.response) return auth.response;
    const { user } = auth;

    const [addonActive, settings, balance, recentTurns] = await Promise.all([
      config.hasAddon(user.businessId),
      loadBusinessAgentSettings(user.businessId, config.agentSlug),
      getCreditBalance(user.businessId),
      loadShortMemory({
        businessId: user.businessId,
        userId: user.id,
        agentSlug: config.agentSlug,
      }),
    ]);

    return NextResponse.json({
      addon_active: addonActive,
      assistant_enabled: settings.assistantEnabled,
      display_name: settings.displayName,
      ...(config.includeDailyNoticeInGet
        ? { daily_notice_enabled: settings.dailyNoticeEnabled }
        : {}),
      reasoning_mode: settings.reasoningMode,
      credit_cost_chat: chatCreditsForReasoning(settings.reasoningMode),
      credit_balance: balance,
      credits_paused:
        balance < chatCreditsForReasoning(settings.reasoningMode),
      business_id: user.businessId,
      recent_turns: recentTurns,
    });
  }

  async function DELETE() {
    const auth = await config.requireUser();
    if (auth.response) return auth.response;
    const { user } = auth;

    await clearShortMemory({
      businessId: user.businessId,
      userId: user.id,
      agentSlug: config.agentSlug,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  async function POST(request: Request) {
    const auth = await config.requireUser();
    if (auth.response) return auth.response;
    const { user } = auth;

    const limited = enforceRateLimit({
      bucket: config.rateLimitBucket,
      identifier: `user:${user.id}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    let parsed;
    try {
      parsed = messageSchema.parse(body);
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

    const postExtrasPromise = config.loadPostExtras
      ? config.loadPostExtras(ctx)
      : Promise.resolve(null);

    const [
      addonActive,
      settings,
      spentTodayCredits,
      businessRes,
      creditBalance,
      historyForModel,
      postExtras,
    ] = await Promise.all([
      config.hasAddon(ctx.businessId),
      loadBusinessAgentSettings(ctx.businessId, config.agentSlug),
      getAgentCreditsSpentToday(ctx.businessId, config.agentSlug),
      supabase
        .from("businesses")
        .select("name")
        .eq("id", ctx.businessId)
        .single(),
      getCreditBalance(ctx.businessId),
      loadShortMemory({
        businessId: ctx.businessId,
        userId: user.id,
        agentSlug: config.agentSlug,
      }),
      postExtrasPromise,
    ]);

    if (!addonActive) {
      return NextResponse.json(
        {
          error: "addon_required",
          message: config.addonRequiredMessage,
          marketplace_href: "/marketplace",
        },
        { status: 403 },
      );
    }

    if (!settings.assistantEnabled) {
      return NextResponse.json(
        {
          error: "assistant_disabled",
          message: config.assistantDisabledMessage,
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

    const postContext: StaffAssistantPostContext = {
      ctx,
      message: parsed.message,
      history: historyForModel,
      settings,
      user,
      extras: postExtras,
      creditBalance,
    };

    if (
      shouldUseFreeClarifierTemplate(
        config.clarifierKind,
        parsed.message,
        historyForModel,
      )
    ) {
      const reply = config.resolveClarifierReply
        ? await config.resolveClarifierReply(postContext)
        : buildFreeClarifierReply(
            config.clarifierKind,
            settings.displayName,
            parsed.message,
          );

      return finishEarlyReply(postContext, {
        reply,
        freeClarifier: true,
      });
    }

    if (config.tryEarlyReply) {
      const early = await config.tryEarlyReply(postContext);
      if (early) {
        return finishEarlyReply(postContext, early);
      }
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
      const { reply, usedActionTool } = await config.runChat({
        ctx,
        message: parsed.message,
        history: historyForModel,
        displayName: settings.displayName,
        businessName: business?.name ?? null,
        settings,
        user,
        extras: postExtras,
      });

      try {
        await saveShortMemory({
          businessId: ctx.businessId,
          userId: user.id,
          agentSlug: config.agentSlug,
          turns: [
            ...historyForModel,
            { role: "user", content: parsed.message },
            { role: "assistant", content: reply },
          ],
        });
      } catch (memoryError) {
        logger.warn(`${config.logKey}.short_memory_failed`, {
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
          reason: `${config.logKey}.chat`,
        });
        totalCharged += firstSpend.charged;

        if (chargeActionTopUp && usedActionTool) {
          try {
            const actionSpend = await spendCredits(ctx, {
              amount: actionTopUp,
              reason: `${config.logKey}.action`,
            });
            totalCharged += actionSpend.charged;
          } catch (actionError) {
            if (!isInsufficientCreditsError(actionError)) {
              throw actionError;
            }
            logger.warn(`${config.logKey}.action_credit_shortfall`, {
              businessId: ctx.businessId,
            });
          }
        }
      }

      const balance = await getCreditBalance(ctx.businessId);

      await recordAiUsage({
        businessId: ctx.businessId,
        actorUserId: ctx.userId,
        triggerType: usedActionTool ? "ACTION" : "CHAT",
        creditsCharged: totalCharged,
        mode: "fast",
        costMyrEstimated: creditsToMyr(totalCharged),
        agentSlug: config.agentSlug,
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
      logger.error(`${config.logKey}.failed`, {
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
            ? config.providerMissingMessage
            : config.unavailableMessage,
        },
        { status: 503 },
      );
    }
  }

  return { GET, POST, DELETE };
}
