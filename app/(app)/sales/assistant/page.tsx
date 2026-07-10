import { redirect } from "next/navigation";
import { SufiAssistantChat } from "@/components/sales/SufiAssistantChat";
import { SufiAssistantShell } from "@/components/sales/layout/sufi-assistant-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUseLeads } from "@/lib/sales/access";
import {
  getCreditBalance,
  hasSalesAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { SALES_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { chatCreditsForReasoning } from "@/lib/settings/reasoning-credits";
import { loadShortMemory } from "@/lib/ai/short-memory";

export const metadata = { title: "Sufi · Sales AI" };
export const dynamic = "force-dynamic";

export default async function SalesAssistantPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!canUseLeads(user.role)) {
    redirect("/sales");
  }

  const [addonActive, settings, balance, recentTurns] = await Promise.all([
    hasSalesAssistantAddon(user.businessId),
    loadBusinessAgentSettings(user.businessId, SALES_AGENT_SLUG),
    getCreditBalance(user.businessId),
    loadShortMemory({
      businessId: user.businessId,
      userId: user.id,
      agentSlug: SALES_AGENT_SLUG,
    }),
  ]);

  return (
    <SufiAssistantShell
      header={
        <div className="shrink-0 border-b border-[#E5E0D8] px-4 py-4 dark:border-hairline-dark lg:px-8">
          <h1 className="text-lg font-bold text-ink dark:text-cream-100">
            {settings.displayName} · Sales AI
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
            Ask in plain language — Sufi plans like sales staff using your
            leads and today&apos;s POS
          </p>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 py-3 lg:px-8 lg:py-4">
        <SufiAssistantChat
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
    </SufiAssistantShell>
  );
}
