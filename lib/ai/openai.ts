import "server-only";

import { logger } from "@/lib/logger";
import { buildBriefing } from "@/lib/ai/context";
import type { AgentContext } from "@/lib/ai/context/types";
import type { Pillar } from "@/lib/permissions";

const DEFAULT_ILMU_BASE = "https://api.ilmu.ai/v1";

/** Resolve ILMU LLM credentials from process env (production `.env`). */
export interface OpenAIConfig {
  apiKey: string;
  organizationId: null;
  defaultModel: string;
  baseUrl: string;
  provider: "ilmu";
}

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
    defaultModel: process.env.ILMU_DEFAULT_MODEL?.trim() || "ilmu-mini-v3.3",
    baseUrl: process.env.ILMU_API_BASE_URL?.trim() || DEFAULT_ILMU_BASE,
    provider: "ilmu",
  };
}

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

import { formatAssistantReply } from "@/lib/ai/assistant-reply";

export interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: ChatToolCall[];
    };
  }>;
}

export function extractChatAssistantText(
  response: ChatCompletionResponse,
): string {
  const text = response.choices?.[0]?.message?.content?.trim();
  if (!text) return "I could not generate a response. Please try again.";
  return formatAssistantReply(text);
}

/**
 * OpenAI-compatible chat completions (works with ILMU and OpenAI).
 */
export async function openaiChat<T = unknown>(
  opts: AgentChatOptions,
): Promise<T> {
  const cfg = await getOpenAIConfig();
  const model = opts.model || cfg.defaultModel;

  let messages = opts.messages;
  const shouldBrief =
    opts.briefingFor && (opts.includeBriefing ?? true);
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

  const base = cfg.baseUrl.replace(/\/$/, "");

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.2,
        ...(opts.max_tokens != null ? { max_tokens: opts.max_tokens } : {}),
        ...(opts.tools?.length
          ? { tools: opts.tools, tool_choice: opts.tool_choice ?? "auto" }
          : {}),
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } catch (e) {
    logger.error("openai.chat.failed", {
      model,
      provider: cfg.provider,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
