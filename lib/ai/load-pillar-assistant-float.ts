import "server-only";

import {
  getCreditBalance,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { chatCreditsForReasoning } from "@/lib/settings/reasoning-credits";
import { loadShortMemory } from "@/lib/ai/short-memory";
import type { PillarAssistantStatus } from "@/lib/ai/pillar-assistant-types";
import {
  getPillarAssistantFloatMeta,
  hasPillarAssistantAddon,
  type PillarAssistantFloatKey,
} from "@/lib/ai/pillar-assistant-float-config";

export async function loadPillarAssistantFloatStatus(
  pillar: PillarAssistantFloatKey,
  businessId: string,
  userId: string,
): Promise<PillarAssistantStatus> {
  const config = getPillarAssistantFloatMeta(pillar);
  const [addonActive, settings, balance, recentTurns] = await Promise.all([
    hasPillarAssistantAddon(pillar, businessId),
    loadBusinessAgentSettings(businessId, config.agentSlug),
    getCreditBalance(businessId),
    loadShortMemory({
      businessId,
      userId,
      agentSlug: config.agentSlug,
    }),
  ]);

  return {
    addon_active: addonActive,
    assistant_enabled: settings.assistantEnabled,
    display_name: settings.displayName,
    credit_balance: balance,
    credits_paused: balance < chatCreditsForReasoning(settings.reasoningMode),
    reasoning_mode: settings.reasoningMode,
    credit_cost_chat: chatCreditsForReasoning(settings.reasoningMode),
    business_id: businessId,
    recent_turns: recentTurns,
  };
}
