import { redirect } from "next/navigation";
import { AimanAssistantChat } from "@/components/operations/AimanAssistantChat";
import { SufiAssistantShell } from "@/components/sales/layout/sufi-assistant-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import {
  getCreditBalance,
  hasOperationsAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { OPERATIONS_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { chatCreditsForReasoning } from "@/lib/settings/reasoning-credits";
import { loadShortMemory } from "@/lib/ai/short-memory";

export const metadata = { title: "Aiman · Operations AI" };
export const dynamic = "force-dynamic";

export default async function OperationsAssistantPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!can(user.role, "operations")) {
    redirect("/operations");
  }

  const [addonActive, settings, balance, recentTurns] = await Promise.all([
    hasOperationsAssistantAddon(user.businessId),
    loadBusinessAgentSettings(user.businessId, OPERATIONS_AGENT_SLUG),
    getCreditBalance(user.businessId),
    loadShortMemory({
      businessId: user.businessId,
      userId: user.id,
      agentSlug: OPERATIONS_AGENT_SLUG,
    }),
  ]);

  return (
    <SufiAssistantShell
      header={
        <div className="shrink-0 border-b border-[#E5E0D8] px-4 py-4 dark:border-hairline-dark lg:px-8">
          <h1 className="text-lg font-bold text-ink dark:text-cream-100">
            {settings.displayName} · Operations AI
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
            Ask in plain language — Aiman plans like ops staff using your
            products, orders, and bookings
          </p>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 py-3 lg:px-8 lg:py-4">
        <AimanAssistantChat
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
