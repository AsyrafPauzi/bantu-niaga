import Link from "next/link";
import { redirect } from "next/navigation";
import { SufiAssistantChat } from "@/components/sales/SufiAssistantChat";
import { SalesBackLink } from "@/components/sales/SalesBackLink";
import {
  PILLAR_ASSISTANT_BODY,
  PillarAssistantHeader,
  PillarAssistantShell,
} from "@/components/dashboard/pillar-assistant-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUseSalesAssistant } from "@/lib/sales/access";
import {
  getCreditBalance,
  hasSalesAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { SALES_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { chatCreditsForReasoning } from "@/lib/settings/reasoning-credits";
import { loadShortMemory } from "@/lib/ai/short-memory";
import { pillarClasses } from "@/lib/pillars/theme";
import { cn } from "@/lib/utils/cn";

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

  if (!canUseSalesAssistant(user.role)) {
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

  const theme = pillarClasses.sales;

  return (
    <PillarAssistantShell
      header={
        <PillarAssistantHeader
          pillar="sales"
          eyebrow="Sales"
          title={`${settings.displayName} · Sales AI`}
          subtitle="Ask in plain language — Sufi plans like sales staff using your leads and today's POS"
          prefix={<SalesBackLink />}
          action={
            <Link
              href="/sales"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-colors",
                theme.btnSecondary,
              )}
            >
              Sales hub
            </Link>
          }
        />
      }
    >
      <div className={PILLAR_ASSISTANT_BODY}>
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
    </PillarAssistantShell>
  );
}
