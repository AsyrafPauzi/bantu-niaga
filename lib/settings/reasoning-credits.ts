import type { ReasoningMode } from "@/lib/settings/ai-agents-catalog";

/** Fast = ilmu-mini-v3.3 (baseline). Deep = ilmu-v3.1 (2× chat, 2× action). */
export const CHAT_CREDITS_BY_REASONING: Record<ReasoningMode, number> = {
  fast: 1,
  deep: 2,
};

export const ACTION_CREDITS_BY_REASONING: Record<ReasoningMode, number> = {
  fast: 2,
  deep: 4,
};

export function chatCreditsForReasoning(mode: ReasoningMode): number {
  return CHAT_CREDITS_BY_REASONING[mode];
}

export function actionCreditsForReasoning(mode: ReasoningMode): number {
  return ACTION_CREDITS_BY_REASONING[mode];
}

export function actionTopUpCreditsForReasoning(mode: ReasoningMode): number {
  return (
    ACTION_CREDITS_BY_REASONING[mode] - CHAT_CREDITS_BY_REASONING[mode]
  );
}

export function reasoningCreditHint(mode: ReasoningMode): string {
  const chat = chatCreditsForReasoning(mode);
  const action = actionCreditsForReasoning(mode);
  return `${chat} credit${chat === 1 ? "" : "s"} per message · ${action} credits if recording leave/actions`;
}
