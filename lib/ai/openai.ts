import "server-only";

import { resolveIntegration } from "@/lib/integrations/load";
import { logger } from "@/lib/logger";
import { buildBriefing } from "@/lib/ai/context";
import type { AgentContext } from "@/lib/ai/context/types";
import type { Pillar } from "@/lib/permissions";

const DEFAULT_OPENAI_BASE = "https://api.openai.com/v1";
const DEFAULT_ILMU_BASE = "https://api.ilmu.ai/v1";

/**
 * Resolve LLM credentials. Prefers ILMU (YTL AI Labs) when configured,
 * otherwise falls back to OpenAI.
 *
 * Resolution order per provider:
 *   1. `platform_integrations.<slug>` row (decrypted)
 *   2. Process env vars
 */
export interface OpenAIConfig {
  apiKey: string;
  organizationId: string | null;
  defaultModel: string;
  baseUrl: string;
  provider: "ilmu" | "openai";
}

export async function getOpenAIConfig(): Promise<OpenAIConfig> {
  const ilmuResolved = await resolveIntegration("ilmu", {
    api_key: process.env.ILMU_API_KEY,
  });

  const ilmuKey =
    ilmuResolved?.secrets.api_key || process.env.ILMU_API_KEY || "";
  if (ilmuKey) {
    return {
      apiKey: ilmuKey,
      organizationId: null,
      defaultModel:
        (ilmuResolved?.config.default_model as string | undefined) ||
        process.env.ILMU_DEFAULT_MODEL ||
        "ilmu-mini-v3.3",
      baseUrl:
        (ilmuResolved?.config.base_url as string | undefined) ||
        process.env.ILMU_API_BASE_URL ||
        DEFAULT_ILMU_BASE,
      provider: "ilmu",
    };
  }

  const openaiResolved = await resolveIntegration("openai", {
    api_key: process.env.OPENAI_API_KEY,
  });

  const apiKey =
    openaiResolved?.secrets.api_key || process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new Error(
      "No AI provider configured. Add ILMU in /super-admin/integrations/ilmu " +
        "(or set ILMU_API_KEY), or configure OpenAI.",
    );
  }

  const organizationId =
    (openaiResolved?.config.organization_id as string | undefined) ||
    process.env.OPENAI_ORGANIZATION_ID ||
    null;

  const defaultModel =
    (openaiResolved?.config.default_model as string | undefined) ||
    process.env.OPENAI_DEFAULT_MODEL ||
    "gpt-4o-mini";

  const baseUrl =
    (openaiResolved?.config.base_url as string | undefined) ||
    process.env.OPENAI_BASE_URL ||
    DEFAULT_OPENAI_BASE;

  return {
    apiKey,
    organizationId,
    defaultModel,
    baseUrl,
    provider: "openai",
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

export interface AgentChatOptions {
  model?: string;
  messages: AgentChatMessage[];
  temperature?: number;
  timeoutMs?: number;
  briefingFor?: Pillar;
  context?: AgentContext;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  includeBriefing?: boolean;
}

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
  return text || "I could not generate a response. Please try again.";
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
  const isOpenAiHost = base.includes("api.openai.com");

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        ...(isOpenAiHost && cfg.organizationId
          ? { "OpenAI-Organization": cfg.organizationId }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.2,
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
