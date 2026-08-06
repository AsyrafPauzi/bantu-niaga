import "server-only";

import { resolveAgentContext } from "@/lib/ai/context";
import {
  composeStaffAgentSystemPrompt,
  loadPublishedAgentScope,
} from "@/lib/ai/agent-scope-runtime";
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
import type { StaffAssistantChatArgs } from "@/lib/ai/staff-assistant-route";
import { resolveAgentModel } from "@/lib/settings/ai-agents-catalog";
import { HR_AGENT_SLUG } from "@/lib/marketplace/agent-types";

export async function runHrAssistantChat(
  args: StaffAssistantChatArgs,
): Promise<{ reply: string; usedActionTool: boolean }> {
  const { ctx, message: userMessage, history, displayName, businessName, settings } =
    args;

  const model = resolveAgentModel({
    reasoningMode: settings.reasoningMode,
    modelOverride: settings.modelOverride,
  });
  const scope = await loadPublishedAgentScope(HR_AGENT_SLUG);
  const systemContent = composeStaffAgentSystemPrompt({
    scope,
    fallbackRules: buildHrAssistantRules({
      displayName,
      businessName: businessName ?? undefined,
      todayIso: malaysiaTodayIso(),
    }),
    displayName,
    businessName: businessName ?? undefined,
    todayIso: malaysiaTodayIso(),
    roleLabel: "HR",
  });
  const baseMessages: AgentChatMessage[] = [
    { role: "system", content: systemContent },
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

export type HrAssistantContext = Awaited<ReturnType<typeof resolveAgentContext>>;
