import "server-only";

import { resolveIntegration } from "@/lib/integrations/load";
import { logger } from "@/lib/logger";
import { buildBriefing } from "@/lib/ai/context";
import type { AgentContext } from "@/lib/ai/context/types";
import type { Pillar } from "@/lib/permissions";

/**
 * Resolve OpenAI credentials for the AI agents.
 *
 * Resolution order:
 *   1. `platform_integrations.openai` row (if enabled, decrypted on the
 *      fly via lib/integrations/load).
 *   2. Process env (`OPENAI_API_KEY`, `OPENAI_ORGANIZATION_ID`,
 *      `OPENAI_DEFAULT_MODEL`).
 *   3. throws — caller must handle.
 *
 * Allowing env fallback keeps existing deployments working unchanged
 * after this migration ships; the super-admin can move to db-managed
 * keys at their leisure.
 */

export interface OpenAIConfig {
  apiKey: string;
  organizationId: string | null;
  defaultModel: string;
}

export async function getOpenAIConfig(): Promise<OpenAIConfig> {
  const resolved = await resolveIntegration("openai", {
    api_key: process.env.OPENAI_API_KEY,
  });

  const apiKey =
    resolved?.secrets.api_key || process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new Error(
      "OpenAI is not configured. Add an API key in /super-admin/integrations/openai or set OPENAI_API_KEY.",
    );
  }

  const organizationId =
    (resolved?.config.organization_id as string | undefined) ||
    process.env.OPENAI_ORGANIZATION_ID ||
    null;

  const defaultModel =
    (resolved?.config.default_model as string | undefined) ||
    process.env.OPENAI_DEFAULT_MODEL ||
    "gpt-4o-mini";

  return { apiKey, organizationId, defaultModel };
}

export interface AgentChatOptions {
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  /** Abort after this many ms. */
  timeoutMs?: number;
  /**
   * Pillar to fetch a strictly tenant-scoped briefing for, then auto-
   * prepend its rendered text as a system message so the agent only
   * sees the caller's own data. Skip this for prompts that don't need
   * tenant-specific context (e.g. generic prompt-template generation).
   */
  briefingFor?: Pillar;
  /** Optional pre-resolved context. If omitted, briefingFor uses resolveAgentContext(). */
  context?: AgentContext;
}

/**
 * Thin convenience wrapper for chat completions.
 *
 * When `briefingFor` is set, this function:
 *   1. Builds the tenant-scoped pillar snapshot (cached for the request).
 *   2. Prepends the rendered briefing as a system message.
 *   3. Hands the resulting message list to OpenAI.
 *
 * This is the recommended path for every AI agent — direct SDK calls
 * bypass the tenant-isolation guarantee.
 */
export async function openaiChat<T = unknown>(
  opts: AgentChatOptions,
): Promise<T> {
  const cfg = await getOpenAIConfig();
  const model = opts.model || cfg.defaultModel;

  let messages = opts.messages;
  if (opts.briefingFor) {
    const briefing = await buildBriefing(opts.briefingFor, opts.context);
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

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        ...(cfg.organizationId
          ? { "OpenAI-Organization": cfg.organizationId }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.2,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } catch (e) {
    logger.error("openai.chat.failed", {
      model,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
