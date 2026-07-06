import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { resolveAgentContext } from "@/lib/ai/context";
import { slowModeDelay, spendCredits } from "@/lib/ai/credits";
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
import { recordAiUsage } from "@/lib/ai/usage";
import { canManageHrCore } from "@/lib/hr/access";
import {
  HR_CREDIT_COST_ACTION,
  HR_CREDIT_COST_CHAT,
} from "@/lib/marketplace/agent-types";
import {
  getCreditBalance,
  hasHrAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const hrAssistantSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(historyMessageSchema).max(8).optional().default([]),
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
): Promise<ChatRunResult> {
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

  const [addonActive, settings, balance] = await Promise.all([
    hasHrAssistantAddon(user.businessId),
    loadBusinessAgentSettings(user.businessId),
    getCreditBalance(user.businessId),
  ]);

  return NextResponse.json({
    addon_active: addonActive,
    assistant_enabled: settings.assistantEnabled,
    display_name: settings.displayName,
    daily_notice_enabled: settings.dailyNoticeEnabled,
    credit_balance: balance,
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireHrUser();
  if (response) return response;

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

  const addonActive = await hasHrAssistantAddon(ctx.businessId);
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

  const settings = await loadBusinessAgentSettings(ctx.businessId);
  if (!settings.assistantEnabled) {
    return NextResponse.json(
      {
        error: "assistant_disabled",
        message: "HR Assistant is turned off in Settings → AI Agents.",
      },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", ctx.businessId)
    .single();

  let totalCharged = 0;
  let mode: "fast" | "slow" = "fast";

  try {
    const firstSpend = await spendCredits(ctx, {
      amount: HR_CREDIT_COST_CHAT,
      reason: "hr.assistant.chat",
      allowSlow: true,
    });
    totalCharged += firstSpend.charged;
    mode = firstSpend.mode;

    if (firstSpend.mode === "slow") {
      await slowModeDelay();
    }

    const { reply, usedActionTool } = await runHrAssistantChat(
      ctx,
      parsed.message,
      parsed.history,
      settings.displayName,
      business?.name ?? null,
    );

    if (usedActionTool && firstSpend.mode === "fast") {
      const actionSpend = await spendCredits(ctx, {
        amount: HR_CREDIT_COST_ACTION - HR_CREDIT_COST_CHAT,
        reason: "hr.assistant.action",
        allowSlow: true,
      });
      totalCharged += actionSpend.charged;
      if (actionSpend.mode === "slow") {
        mode = "slow";
      }
    }

    const balance = await getCreditBalance(ctx.businessId);

    await recordAiUsage({
      businessId: ctx.businessId,
      triggerType: usedActionTool ? "ACTION" : "CHAT",
      creditsCharged: totalCharged,
      mode,
      metadata: { used_action_tool: usedActionTool },
    });

    return NextResponse.json(
      {
        reply,
        credits: {
          charged: totalCharged,
          balance,
          mode,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("hr.assistant.failed", {
      businessId: ctx.businessId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: "assistant_unavailable",
        message:
          "The HR assistant is temporarily unavailable. Configure ILMU or OpenAI in Integrations.",
      },
      { status: 503 },
    );
  }
}
