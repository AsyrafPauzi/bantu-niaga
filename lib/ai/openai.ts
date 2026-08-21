import "server-only";

/**
 * Primary LLM client.
 *
 * All call sites in the app go through openaiChat(). The underlying provider
 * (ILMU, OpenAI, …) is resolved at runtime via lib/ai/provider.ts so it can
 * be swapped by changing the ILMU_PROVIDER env var — no business-logic
 * changes required.
 *
 * Provider implementations live in lib/ai/providers/*.
 * Each provider file self-registers via registerProvider() on import.
 */

// Boot all available providers so the registry is populated.
import "@/lib/ai/providers/ilmu";

/** Fallback model name used when ILMU_DEFAULT_MODEL is not set. */
const FALLBACK_MODEL = "ilmu-mini-v3.3";

import { logger } from "@/lib/logger";
import { buildBriefing } from "@/lib/ai/context";
import type { AgentContext } from "@/lib/ai/context/types";
import type { Pillar } from "@/lib/permissions";
import { getAIProvider, type AICompletionResponse } from "@/lib/ai/provider";
import { formatAssistantReply } from "@/lib/ai/assistant-reply";

// ---------------------------------------------------------------------------
// Re-exported types (kept for backwards compatibility with callers)
// ---------------------------------------------------------------------------

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface AgentChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

export type AgentChatTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export interface AgentChatOptions {
  model?: string;
  messages: AgentChatMessage[];
  temperature?: number;
  timeoutMs?: number;
  briefingFor?: Pillar;
  context?: AgentContext;
  tools?: readonly AgentChatTool[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  includeBriefing?: boolean;
  /** Cap completion length (e.g. free smart clarifiers). */
  max_tokens?: number;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/** Legacy shape — kept so callers using the raw response don't break. */
export interface ChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: ChatToolCall[];
    };
  }>;
  /** Real token counts from the provider — always present after this update. */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export function extractChatAssistantText(
  response: ChatCompletionResponse,
): string {
  const text = response.choices?.[0]?.message?.content?.trim();
  if (!text) return "I could not generate a response. Please try again.";
  return formatAssistantReply(text);
}

// ---------------------------------------------------------------------------
// Enriched response (includes token usage for cost tracking)
// ---------------------------------------------------------------------------

export interface AIChatResult {
  /** Provider-agnostic normalised response. */
  response: AICompletionResponse;
  /** Convenience accessor — validated and formatted reply text. */
  replyText: string;
  /** Tool calls if the model chose to invoke tools. */
  toolCalls: ChatToolCall[];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Send a chat completion request through the active AI provider.
 *
 * Returns an {@link AIChatResult} with the full provider response (including
 * real token counts), formatted reply text, and tool calls.
 *
 * Pass `includeBriefing: false` to skip tenant data injection.
 */
export async function openaiChatFull(opts: AgentChatOptions): Promise<AIChatResult> {
  const provider = await getAIProvider();

  let messages = opts.messages;

  // Inject tenant briefing as the first system message when requested
  const shouldBrief = opts.briefingFor && (opts.includeBriefing ?? true);
  if (shouldBrief) {
    const briefing = await buildBriefing(opts.briefingFor!, opts.context);
    messages = [
      {
        role: "system",
        content:
          `You are answering questions strictly about ONE tenant. The data ` +
          `packet below is the only source of truth. Never reveal data from ` +
          `other tenants and never invent figures not in the packet.\n\n` +
          briefing.text,
      },
      ...messages,
    ];
  }

  const model = opts.model ?? (process.env.ILMU_DEFAULT_MODEL?.trim() || FALLBACK_MODEL);

  try {
    const response = await provider.complete({
      model,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.max_tokens,
      tools: opts.tools,
      tool_choice: opts.tool_choice,
      timeoutMs: opts.timeoutMs,
    });

    const rawText = response.choices[0]?.message?.content ?? "";
    const replyText = rawText.trim()
      ? formatAssistantReply(rawText)
      : "I could not generate a response. Please try again.";

    const toolCalls = (response.choices[0]?.message?.tool_calls ?? []) as ChatToolCall[];

    logger.info("ai.complete.ok", {
      provider: response.provider,
      model: response.model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
    });

    return { response, replyText, toolCalls };
  } catch (e) {
    logger.error("ai.complete.failed", {
      model,
      provider: provider.name,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Backward-compatible generic shim
//
// All existing call sites use openaiChat<SomeType>() and read from the
// raw JSON shape.  This shim keeps them working without changes while
// routing through the new provider abstraction.
// ---------------------------------------------------------------------------

/**
 * Backward-compatible overload.
 *
 * Existing call sites: `const res = await openaiChat<ChatCompletionResponse>(opts)`
 * Still work exactly as before — they receive the legacy JSON shape.
 *
 * For new code that needs real token counts, use openaiChatFull() instead.
 */
export async function openaiChatRaw<T = ChatCompletionResponse>(
  opts: AgentChatOptions,
): Promise<T> {
  const { response } = await openaiChatFull(opts);
  const legacy: ChatCompletionResponse = {
    id: response.id,
    model: response.model,
    choices: response.choices.map((c) => ({
      message: {
        content: c.message.content,
        tool_calls: c.message.tool_calls as ChatToolCall[] | undefined,
      },
    })),
    usage: {
      prompt_tokens: response.usage.promptTokens,
      completion_tokens: response.usage.completionTokens,
      total_tokens: response.usage.totalTokens,
    },
  };
  return legacy as T;
}

/**
 * Alias kept for the many existing call sites that import `openaiChat`.
 * Calls are routed through the provider abstraction + retry logic.
 */
export { openaiChatRaw as openaiChat };

// ---------------------------------------------------------------------------
// Config accessor (kept for files that still import getOpenAIConfig)
// ---------------------------------------------------------------------------

export interface OpenAIConfig {
  apiKey: string;
  organizationId: null;
  defaultModel: string;
  baseUrl: string;
  provider: "ilmu";
}

/** @deprecated Resolve config through the provider abstraction instead. */
export async function getOpenAIConfig(): Promise<OpenAIConfig> {
  const apiKey = process.env.ILMU_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new Error(
      "No AI provider configured. Set ILMU_API_KEY in your environment.",
    );
  }
  return {
    apiKey,
    organizationId: null,
    defaultModel: process.env.ILMU_DEFAULT_MODEL?.trim() || FALLBACK_MODEL,
    baseUrl:
      (process.env.ILMU_API_BASE_URL?.trim() || "https://api.ilmu.ai/v1").replace(
        /\/$/,
        "",
      ),
    provider: "ilmu",
  };
}
