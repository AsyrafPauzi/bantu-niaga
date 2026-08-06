import "server-only";

import {
  composeStaffAgentSystemPrompt,
  loadPublishedAgentScope,
} from "@/lib/ai/agent-scope-runtime";
import type { PillarSnapshot } from "@/lib/ai/context/types";
import { buildSalesAssistantRules } from "@/lib/ai/sales-assistant-prompt";
import {
  SALES_ASSISTANT_TOOLS,
  executeSalesAssistantTool,
  isSalesActionTool,
  malaysiaTodayIso,
} from "@/lib/ai/sales-assistant-tools";
import {
  extractChatAssistantText,
  openaiChat,
  type AgentChatMessage,
  type ChatCompletionResponse,
} from "@/lib/ai/openai";
import type { StaffAssistantChatArgs } from "@/lib/ai/staff-assistant-route";
import { STAFF_ASSISTANT_MAX_TOKENS } from "@/lib/ai/staff-assistant-shared";
import {
  detectUserLanguage,
  userLanguageInstruction,
} from "@/lib/ai/user-language";
import { SALES_AGENT_SLUG } from "@/lib/marketplace/agent-types";
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

export function formatSalesSnapshotPacket(snapshot: PillarSnapshot): string {
  return formatSnapshotPacket(snapshot);
}

export async function runSalesAssistantChat(
  args: StaffAssistantChatArgs,
): Promise<{ reply: string; usedActionTool: boolean }> {
  const {
    ctx,
    message: userMessage,
    history,
    displayName,
    businessName,
    settings,
    extras,
  } = args;

  const salesPacketText =
    extras &&
    typeof extras === "object" &&
    extras !== null &&
    "packetText" in extras &&
    typeof (extras as { packetText: string }).packetText === "string"
      ? (extras as { packetText: string }).packetText
      : typeof extras === "string"
        ? extras
        : formatSnapshotPacket(extras as PillarSnapshot);

  const model = resolveAgentModel({
    reasoningMode: settings.reasoningMode,
    modelOverride: settings.modelOverride,
  });
  const lang = detectUserLanguage(userMessage);
  const scope = await loadPublishedAgentScope(SALES_AGENT_SLUG);
  const systemContent = composeStaffAgentSystemPrompt({
    scope,
    fallbackRules: buildSalesAssistantRules({
      displayName,
      businessName: businessName ?? undefined,
      todayIso: malaysiaTodayIso(),
      userLanguageInstruction: userLanguageInstruction(lang),
    }),
    displayName,
    businessName: businessName ?? undefined,
    todayIso: malaysiaTodayIso(),
    roleLabel: "Sales",
    dataPacketLabel: "DATA PACKET — SALES (leads + POS today):",
    dataPacketText: salesPacketText,
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

  let completion = await openaiChat<ChatCompletionResponse>({
    model,
    briefingFor: "sales",
    context: ctx,
    temperature: 0.2,
    max_tokens: STAFF_ASSISTANT_MAX_TOKENS,
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
    max_tokens: STAFF_ASSISTANT_MAX_TOKENS,
    messages: followUpMessages,
    includeBriefing: false,
    tool_choice: "none",
  });

  return {
    reply: extractChatAssistantText(completion),
    usedActionTool,
  };
}
