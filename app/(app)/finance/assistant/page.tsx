import { redirect } from "next/navigation";
import { FayzaAssistantChat } from "@/components/finance/FayzaAssistantChat";
import { SufiAssistantShell } from "@/components/sales/layout/sufi-assistant-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUseFinanceAssistant } from "@/lib/finance/access";
import {
  getCreditBalance,
  hasFinanceAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { FINANCE_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { chatCreditsForReasoning } from "@/lib/settings/reasoning-credits";
import { loadShortMemory } from "@/lib/ai/short-memory";

export const metadata = { title: "Fayza · Finance AI" };
export const dynamic = "force-dynamic";

export default async function FinanceAssistantPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!canUseFinanceAssistant(user.role)) {
    redirect("/finance");
  }

  const [addonActive, settings, balance, recentTurns] = await Promise.all([
    hasFinanceAssistantAddon(user.businessId),
    loadBusinessAgentSettings(user.businessId, FINANCE_AGENT_SLUG),
    getCreditBalance(user.businessId),
    loadShortMemory({
      businessId: user.businessId,
      userId: user.id,
      agentSlug: FINANCE_AGENT_SLUG,
    }),
  ]);

  return (
    <SufiAssistantShell
      header={
        <div className="shrink-0 border-b border-[#E5E0D8] px-4 py-4 dark:border-hairline-dark lg:px-8">
          <h1 className="text-lg font-bold text-ink dark:text-cream-100">
            {settings.displayName} · Finance AI
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
            Ask in plain language — Fayza plans like finance staff using your
            invoices and cash flow
          </p>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 py-3 lg:px-8 lg:py-4">
        <FayzaAssistantChat
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
