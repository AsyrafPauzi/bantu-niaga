import { redirect } from "next/navigation";
import { HrAssistantChat } from "@/components/hr/HrAssistantChat";
import { HrAssistantShell } from "@/components/hr/layout/hr-assistant-shell";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import {
  getCreditBalance,
  hasHrAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { HR_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { chatCreditsForReasoning } from "@/lib/settings/reasoning-credits";
import { loadShortMemory } from "@/lib/ai/short-memory";

export const metadata = { title: "HR AI Assistant" };
export const dynamic = "force-dynamic";

export default async function HrAssistantPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!canManageHrCore(user.role)) {
    redirect("/hr");
  }

  const [addonActive, settings, balance, recentTurns] = await Promise.all([
    hasHrAssistantAddon(user.businessId),
    loadBusinessAgentSettings(user.businessId),
    getCreditBalance(user.businessId),
    loadShortMemory({
      businessId: user.businessId,
      userId: user.id,
      agentSlug: HR_AGENT_SLUG,
    }),
  ]);

  return (
    <HrAssistantShell
      header={
        <HrPageHeader
          title={`${settings.displayName} · HR Assistant`}
          subtitle="Ask like you would HR staff — she clarifies, plans from your records, then can record or approve leave"
          helpHref="/more"
          className="px-4 lg:px-8"
        />
      }
    >
      <HrMobileSubnav className="shrink-0 border-b border-[#E5E0D8] px-4 dark:border-hairline-dark lg:px-8" />
      <div className="flex min-h-0 flex-1 flex-col px-4 py-3 lg:px-8 lg:py-4">
        <HrAssistantChat
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
    </HrAssistantShell>
  );
}
