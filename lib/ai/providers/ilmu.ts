import "server-only";

import { logger } from "@/lib/logger";
import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
} from "@/lib/ai/provider";
import { registerProvider } from "@/lib/ai/provider";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_BASE = "https://api.ilmu.ai/v1";
const DEFAULT_MODEL = "ilmu-mini-v3.3";

function resolveConfig() {
  const apiKey = process.env.ILMU_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new Error(
      "No AI provider configured. Set ILMU_API_KEY in your environment.",
    );
  }
  return {
    apiKey,
    baseUrl: (process.env.ILMU_API_BASE_URL?.trim() || DEFAULT_BASE).replace(
      /\/$/,
      "",
    ),
    defaultModel: process.env.ILMU_DEFAULT_MODEL?.trim() || DEFAULT_MODEL,
  };
}

// ---------------------------------------------------------------------------
// Retry helpers
// ---------------------------------------------------------------------------

/** Status codes that are safe to retry. */
const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);

/** Max attempts (1 original + 2 retries). */
const MAX_ATTEMPTS = 3;

/** Base delay in ms for exponential backoff. */
const BASE_DELAY_MS = 500;

function retryDelayMs(attempt: number): number {
  // Exponential backoff with ±20 % jitter: 500, 1 000, 2 000 …
  const base = BASE_DELAY_MS * 2 ** attempt;
  const jitter = base * 0.2 * (Math.random() - 0.5);
  return Math.round(base + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// ILMU provider
// ---------------------------------------------------------------------------

class IlmuProvider implements AIProvider {
  readonly name = "ilmu";

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    const cfg = resolveConfig();
    const model = req.model || cfg.defaultModel;
    const url = `${cfg.baseUrl}/chat/completions`;

    const body = JSON.stringify({
      model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
      ...(req.max_tokens != null ? { max_tokens: req.max_tokens } : {}),
      ...(req.tools?.length
        ? { tools: req.tools, tool_choice: req.tool_choice ?? "auto" }
        : {}),
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        const delay = retryDelayMs(attempt - 1);
        logger.warn("ai.retry", { model, attempt, delayMs: delay });
        await sleep(delay);
      }

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            "Content-Type": "application/json",
          },
          body,
          signal: AbortSignal.timeout(req.timeoutMs ?? 30_000),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const err = new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`);

          if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS - 1) {
            logger.warn("ai.retryable_error", {
              model,
              status: res.status,
              attempt,
            });
            lastError = err;
            continue;
          }
          throw err;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json: any = await res.json();

        return {
          id: json.id ?? "",
          model: json.model ?? model,
          provider: "ilmu",
          choices: (json.choices ?? []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any) => ({
              message: {
                role: "assistant" as const,
                content: c.message?.content ?? null,
                tool_calls: c.message?.tool_calls,
              },
              finish_reason: c.finish_reason ?? null,
            }),
          ),
          usage: {
            promptTokens: json.usage?.prompt_tokens ?? 0,
            completionTokens: json.usage?.completion_tokens ?? 0,
            totalTokens: json.usage?.total_tokens ?? 0,
          },
        };
      } catch (e) {
        const isTimeout =
          e instanceof Error &&
          (e.name === "TimeoutError" || e.name === "AbortError");

        if (isTimeout && attempt < MAX_ATTEMPTS - 1) {
          logger.warn("ai.timeout_retry", { model, attempt });
          lastError = e instanceof Error ? e : new Error(String(e));
          continue;
        }

        logger.error("ai.complete.failed", {
          model,
          provider: "ilmu",
          attempt,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    }

    // All retries exhausted
    throw lastError ?? new Error("AI request failed after retries.");
  }
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

let _instance: IlmuProvider | null = null;

registerProvider("ilmu", async () => {
  _instance ??= new IlmuProvider();
  return _instance;
});

export { IlmuProvider };
