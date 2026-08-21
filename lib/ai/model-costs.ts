import "server-only";

/**
 * Per-model token pricing table.
 *
 * Prices are in MYR per 1 000 tokens (input / output separate).
 * Update this table when models or pricing change — no other code needs
 * to change.
 *
 * Sources:
 *  - ILMU: YTL AI Labs pricing (estimated, adjust to actual invoice rates)
 *  - OpenAI: https://openai.com/pricing
 */

export interface ModelCostEntry {
  /** Provider that serves this model. */
  provider: "ilmu" | "openai";
  /** MYR per 1 000 input (prompt) tokens. */
  inputMyrPer1k: number;
  /** MYR per 1 000 output (completion) tokens. */
  outputMyrPer1k: number;
}

const MODEL_COSTS: Record<string, ModelCostEntry> = {
  // ILMU AI Labs ---------------------------------------------------------------
  "ilmu-mini-v3.3": {
    provider: "ilmu",
    inputMyrPer1k: 0.01,
    outputMyrPer1k: 0.03,
  },
  "ilmu-v3.1": {
    provider: "ilmu",
    inputMyrPer1k: 0.04,
    outputMyrPer1k: 0.12,
  },
  // OpenAI (fallback if provider is switched) -----------------------------------
  "gpt-4o-mini": {
    provider: "openai",
    inputMyrPer1k: 0.0066, // USD 0.00015 × 4.4 RM/USD
    outputMyrPer1k: 0.0264, // USD 0.0006  × 4.4
  },
  "gpt-4o": {
    provider: "openai",
    inputMyrPer1k: 0.022,
    outputMyrPer1k: 0.088,
  },
  "nemo-super": {
    provider: "ilmu",
    inputMyrPer1k: 0.02,
    outputMyrPer1k: 0.06,
  },
};

/** Fallback cost when the model is unknown. Errs on the side of over-estimating. */
const FALLBACK_COST: ModelCostEntry = {
  provider: "ilmu",
  inputMyrPer1k: 0.05,
  outputMyrPer1k: 0.15,
};

export function getModelCost(model: string): ModelCostEntry {
  return MODEL_COSTS[model] ?? FALLBACK_COST;
}

/**
 * Estimate the MYR cost for a single completion call.
 * Returns 0 when token counts are unavailable (never throws).
 */
export function estimateCostMyr(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  if (!promptTokens && !completionTokens) return 0;
  const costs = getModelCost(model);
  return (
    (promptTokens / 1000) * costs.inputMyrPer1k +
    (completionTokens / 1000) * costs.outputMyrPer1k
  );
}
