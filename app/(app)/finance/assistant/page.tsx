import Link from "next/link";
import { redirect } from "next/navigation";
import { FayzaAssistantChat } from "@/components/finance/FayzaAssistantChat";
import {
  PILLAR_ASSISTANT_BODY,
  PillarAssistantHeader,
  PillarAssistantShell,
} from "@/components/dashboard/pillar-assistant-shell";
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
import { pillarClasses } from "@/lib/pillars/theme";
import { cn } from "@/lib/utils/cn";

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

  const theme = pillarClasses.finance;

  return (
    <PillarAssistantShell
      header={
        <PillarAssistantHeader
          pillar="finance"
          eyebrow="Finance"
          title={`${settings.displayName} · Finance AI`}
          subtitle="Ask in plain language — Fayza reads your books and can log expenses, create invoices, chase payments, and more"
          action={
            <Link
              href="/finance"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-colors",
                theme.btnSecondary,
              )}
            >
              Back to Finance
            </Link>
          }
        />
      }
    >
      <div className={PILLAR_ASSISTANT_BODY}>
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
    </PillarAssistantShell>
  );
}
