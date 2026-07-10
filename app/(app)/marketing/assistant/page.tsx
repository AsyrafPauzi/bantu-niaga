import { redirect } from "next/navigation";
import { MayaAssistantChat } from "@/components/marketing/MayaAssistantChat";
import { MayaAssistantShell } from "@/components/marketing/layout/maya-assistant-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageMarketingCore } from "@/lib/marketing/access";
import {
  getCreditBalance,
  hasMarketingAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { MARKETING_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { chatCreditsForReasoning } from "@/lib/settings/reasoning-credits";
import { loadShortMemory } from "@/lib/ai/short-memory";

export const metadata = { title: "Maya · Marketing AI" };
export const dynamic = "force-dynamic";

export default async function MarketingAssistantPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!canManageMarketingCore(user.role)) {
    redirect("/marketing");
  }

  const [addonActive, settings, balance, recentTurns] = await Promise.all([
    hasMarketingAssistantAddon(user.businessId),
    loadBusinessAgentSettings(user.businessId, MARKETING_AGENT_SLUG),
    getCreditBalance(user.businessId),
    loadShortMemory({
      businessId: user.businessId,
      userId: user.id,
      agentSlug: MARKETING_AGENT_SLUG,
    }),
  ]);

  return (
    <MayaAssistantShell
      header={
        <div className="shrink-0 border-b border-[#E5E0D8] px-4 py-4 dark:border-hairline-dark lg:px-8">
          <h1 className="text-lg font-bold text-ink dark:text-cream-100">
            {settings.displayName} · Marketing AI
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
            Ask in plain language — Maya plans like marketing staff using your
            CRM, products, and monthly sales
          </p>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 py-3 lg:px-8 lg:py-4">
        <MayaAssistantChat
          businessId={user.businessId}
          initialStatus={{
            addon_active: addonActive,
            assistant_enabled: settings.assistantEnabled,
            display_name: settings.displayName,
            credit_balance: balance,
            credits_paused:
              balance < chatCreditsForReasoning(settings.reasoningMode),
            reasoning_mode: settings.reasoningMode,
            credit_cost_chat: chatCreditsForReasoning(settings.reasoningMode),
            business_id: user.businessId,
            recent_turns: recentTurns,
          }}
        />
      </div>
    </MayaAssistantShell>
  );
}
