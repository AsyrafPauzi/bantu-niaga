import { MayaPanel } from "@/components/marketing/MayaPanel";
import {
  getCreditBalance,
  hasMarketingAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { MARKETING_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { chatCreditsForReasoning } from "@/lib/settings/reasoning-credits";
import { loadShortMemory } from "@/lib/ai/short-memory";

export async function MayaFloatingAssistant({
  businessId,
  userId,
}: {
  businessId: string;
  userId: string;
}) {
  const [addonActive, settings, balance, recentTurns] = await Promise.all([
    hasMarketingAssistantAddon(businessId),
    loadBusinessAgentSettings(businessId, MARKETING_AGENT_SLUG),
    getCreditBalance(businessId),
    loadShortMemory({
      businessId,
      userId,
      agentSlug: MARKETING_AGENT_SLUG,
    }),
  ]);

  return (
    <MayaPanel
      businessId={businessId}
      initialStatus={{
        addon_active: addonActive,
        assistant_enabled: settings.assistantEnabled,
        display_name: settings.displayName,
        credit_balance: balance,
        credits_paused:
          balance < chatCreditsForReasoning(settings.reasoningMode),
        reasoning_mode: settings.reasoningMode,
        credit_cost_chat: chatCreditsForReasoning(settings.reasoningMode),
        business_id: businessId,
        recent_turns: recentTurns,
      }}
    />
  );
}
