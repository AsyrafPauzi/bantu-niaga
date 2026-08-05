import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminAssistantChat } from "@/components/admin/AdminAssistantChat";
import {
  PILLAR_ASSISTANT_BODY,
  PillarAssistantHeader,
  PillarAssistantShell,
} from "@/components/dashboard/pillar-assistant-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUseAdminAssistant } from "@/lib/admin/access";
import {
  getCreditBalance,
  hasAdminAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { ADMIN_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { chatCreditsForReasoning } from "@/lib/settings/reasoning-credits";
import { loadShortMemory } from "@/lib/ai/short-memory";
import { pillarClasses } from "@/lib/pillars/theme";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Amir · Admin AI" };
export const dynamic = "force-dynamic";

export default async function AdminAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: initialPrompt } = await searchParams;
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!canUseAdminAssistant(user.role)) {
    redirect("/admin");
  }

  const [addonActive, settings, balance, recentTurns] = await Promise.all([
    hasAdminAssistantAddon(user.businessId),
    loadBusinessAgentSettings(user.businessId, ADMIN_AGENT_SLUG),
    getCreditBalance(user.businessId),
    loadShortMemory({
      businessId: user.businessId,
      userId: user.id,
      agentSlug: ADMIN_AGENT_SLUG,
    }),
  ]);

  const theme = pillarClasses.admin;

  return (
    <PillarAssistantShell
      header={
        <PillarAssistantHeader
          pillar="admin"
          eyebrow="Admin"
          title={`${settings.displayName} · Admin AI`}
          subtitle="Ask in plain language — Amir plans like back-office staff using your tasks, renewals, and document storage"
          action={
            <Link
              href="/admin"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-colors",
                theme.btnSecondary,
              )}
            >
              Back to Admin
            </Link>
          }
        />
      }
    >
      <div className={PILLAR_ASSISTANT_BODY}>
        <AdminAssistantChat
          businessId={user.businessId}
          initialPrompt={initialPrompt ?? null}
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
