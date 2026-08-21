import "server-only";

import {
  composeStaffAgentSystemPrompt,
  loadPublishedAgentScope,
} from "@/lib/ai/agent-scope-runtime";
import type { PillarSnapshot } from "@/lib/ai/context/types";
import { buildFinanceAssistantRules } from "@/lib/ai/finance-assistant-prompt";
import {
  FINANCE_ASSISTANT_TOOLS,
  executeFinanceAssistantTool,
  isFinanceActionTool,
  malaysiaTodayIso,
} from "@/lib/ai/finance-assistant-tools";
import {
  openaiChatFull,
  type AgentChatMessage,
} from "@/lib/ai/openai";
import type { StaffAssistantChatArgs } from "@/lib/ai/staff-assistant-route";
import { STAFF_ASSISTANT_MAX_TOKENS } from "@/lib/ai/staff-assistant-shared";
import {
  detectUserLanguage,
  userLanguageInstruction,
} from "@/lib/ai/user-language";
import { FINANCE_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { resolveAgentModel } from "@/lib/settings/ai-agents-catalog";

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

export function formatFinanceSnapshotPacket(snapshot: PillarSnapshot): string {
  return formatSnapshotPacket(snapshot);
}

export async function runFinanceAssistantChat(
  args: StaffAssistantChatArgs,
): Promise<{ reply: string; usedActionTool: boolean; tokensIn: number; tokensOut: number; model: string }> {
  const {
    ctx,
    message: userMessage,
    history,
    displayName,
    businessName,
    settings,
    extras,
  } = args;

  const financePacketText =
    typeof extras === "string"
      ? extras
      : formatSnapshotPacket(extras as PillarSnapshot);

  const model = resolveAgentModel({
    reasoningMode: settings.reasoningMode,
    modelOverride: settings.modelOverride,
  });
  const lang = detectUserLanguage(userMessage);
  const scope = await loadPublishedAgentScope(FINANCE_AGENT_SLUG);
  const systemContent = composeStaffAgentSystemPrompt({
    scope,
    fallbackRules: buildFinanceAssistantRules({
      displayName,
      businessName: businessName ?? undefined,
      todayIso: malaysiaTodayIso(),
      userLanguageInstruction: userLanguageInstruction(lang),
    }),
    displayName,
    businessName: businessName ?? undefined,
    todayIso: malaysiaTodayIso(),
    roleLabel: "Finance",
    dataPacketLabel: "DATA PACKET — FINANCE (invoices + cash flow):",
    dataPacketText: financePacketText,
    extraBlocks: scope?.systemPrompt
      ? [userLanguageInstruction(lang)].filter(Boolean)
      : undefined,
  });
  const baseMessages: AgentChatMessage[] = [
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

  // Use openaiChatFull to capture real token counts for cost tracking.
  let result = await openaiChatFull({
    model,
    briefingFor: "finance",
    context: ctx,
    temperature: 0.2,
    max_tokens: STAFF_ASSISTANT_MAX_TOKENS,
    messages: baseMessages,
    tools: FINANCE_ASSISTANT_TOOLS,
    tool_choice: "auto",
  });

  let tokensIn = result.response.usage.promptTokens;
  let tokensOut = result.response.usage.completionTokens;

  const assistantMessage = result.response.choices[0]?.message;
  const toolCalls = result.toolCalls;

  if (toolCalls.length === 0) {
    return {
      reply: result.replyText,
      usedActionTool: false,
      tokensIn,
      tokensOut,
      model,
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

    if (isFinanceActionTool(toolCall.function.name)) {
      usedActionTool = true;
    }

    const toolResult = await executeFinanceAssistantTool(
      ctx,
      toolCall.function.name,
      parsedArgs,
    );

    followUpMessages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify(toolResult),
    });
  }

  result = await openaiChatFull({
    model,
    context: ctx,
    temperature: 0.2,
    max_tokens: STAFF_ASSISTANT_MAX_TOKENS,
    messages: followUpMessages,
    includeBriefing: false,
    tool_choice: "none",
  });

  // Accumulate tokens across both LLM calls.
  tokensIn += result.response.usage.promptTokens;
  tokensOut += result.response.usage.completionTokens;

  return {
    reply: result.replyText,
    usedActionTool,
    tokensIn,
    tokensOut,
    model,
  };
}
