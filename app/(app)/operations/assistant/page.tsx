import Link from "next/link";
import { redirect } from "next/navigation";
import { AimanAssistantChat } from "@/components/operations/AimanAssistantChat";
import {
  PILLAR_ASSISTANT_BODY,
  PillarAssistantHeader,
  PillarAssistantShell,
} from "@/components/dashboard/pillar-assistant-shell";
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
import { pillarClasses } from "@/lib/pillars/theme";
import { cn } from "@/lib/utils/cn";

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

  const theme = pillarClasses.operations;

  return (
    <PillarAssistantShell
      header={
        <PillarAssistantHeader
          pillar="operations"
          eyebrow="Operations"
          title={`${settings.displayName} · Operations AI`}
          subtitle="Ask in plain language — Aiman reads live ops data, updates orders and bookings, and routes Finance or HR questions to the right AI"
          action={
            <Link
              href="/operations"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-colors",
                theme.btnSecondary,
              )}
            >
              Back to Operations
            </Link>
          }
        />
      }
    >
      <div className={PILLAR_ASSISTANT_BODY}>
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
    </PillarAssistantShell>
  );
}
