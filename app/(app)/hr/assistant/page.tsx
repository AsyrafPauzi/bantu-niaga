import Link from "next/link";
import { redirect } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { HrAssistantChat } from "@/components/hr/HrAssistantChat";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import {
  PILLAR_ASSISTANT_BODY,
  PillarAssistantHeader,
  PillarAssistantShell,
} from "@/components/dashboard/pillar-assistant-shell";
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
import { pillarClasses } from "@/lib/pillars/theme";
import { cn } from "@/lib/utils/cn";

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

  const theme = pillarClasses.hr;

  return (
    <PillarAssistantShell
      header={
        <>
          <PillarAssistantHeader
            pillar="hr"
            eyebrow="HR"
            title={`${settings.displayName} · HR Assistant`}
            subtitle="Ask like you would HR staff — she clarifies, plans from your records, then can record or approve leave"
            action={
              <Link
                href="/more"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-colors",
                  theme.btnSecondary,
                )}
              >
                <HelpCircle className="h-4 w-4" strokeWidth={2} />
                Get help
              </Link>
            }
          />
          <HrMobileSubnav className="shrink-0 border-b border-cream-200 px-4 dark:border-hairline-dark lg:px-8" />
        </>
      }
    >
      <div className={PILLAR_ASSISTANT_BODY}>
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
    </PillarAssistantShell>
  );
}
