import "server-only";

/**
 * Provider abstraction layer.
 *
 * All LLM providers must conform to this interface so callers can swap
 * providers (ILMU → OpenAI → Anthropic) purely via config without touching
 * business logic.
 *
 * Concrete implementations live in lib/ai/providers/ilmu.ts (and future files).
 * The active provider is resolved by getAIProvider() below.
 */

import type { AgentChatMessage, AgentChatTool, ChatToolCall } from "./openai";

// ---------------------------------------------------------------------------
// Canonical response shape (provider-agnostic)
// ---------------------------------------------------------------------------

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIChoice {
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: ChatToolCall[];
  };
  finish_reason: string | null;
}

export interface AICompletionResponse {
  id: string;
  model: string;
  provider: string;
  choices: AIChoice[];
  usage: AIUsage;
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface AICompletionRequest {
  model: string;
  messages: AgentChatMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: readonly AgentChatTool[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  timeoutMs?: number;
}

export interface AIProvider {
  readonly name: string;
  /**
   * Send a chat completion request and return a normalised response.
   * Must never expose the API key in thrown errors or logs.
   */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
}

// ---------------------------------------------------------------------------
// Registry — add new providers here
// ---------------------------------------------------------------------------

type ProviderName = "ilmu" | "openai";

const _registry = new Map<ProviderName, () => Promise<AIProvider>>();

export function registerProvider(
  name: ProviderName,
  factory: () => Promise<AIProvider>,
): void {
  _registry.set(name, factory);
}

/**
 * Returns the active provider resolved from ILMU_PROVIDER env.
 * Falls back to "ilmu" (the ILMU AI Labs OpenAI-compatible endpoint).
 */
export async function getAIProvider(): Promise<AIProvider> {
  const name = (process.env.ILMU_PROVIDER?.trim() ?? "ilmu") as ProviderName;
  const factory = _registry.get(name);
  if (!factory) {
    throw new Error(
      `AI provider "${name}" is not registered. ` +
        `Set ILMU_PROVIDER to one of: ${[..._registry.keys()].join(", ")}`,
    );
  }
  return factory();
}
