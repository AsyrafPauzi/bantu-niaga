import Link from "next/link";
import { redirect } from "next/navigation";
import { MayaAssistantChat } from "@/components/marketing/MayaAssistantChat";
import {
  PILLAR_ASSISTANT_BODY,
  PillarAssistantHeader,
  PillarAssistantShell,
} from "@/components/dashboard/pillar-assistant-shell";
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
import { pillarClasses } from "@/lib/pillars/theme";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Maya · Marketing AI" };
export const dynamic = "force-dynamic";

export default async function MarketingAssistantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  const sp = await searchParams;
  const seed =
    typeof sp.seed === "string" && sp.seed.trim().length > 0
      ? sp.seed.trim().slice(0, 2000)
      : undefined;

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

  const theme = pillarClasses.marketing;

  return (
    <PillarAssistantShell
      header={
        <PillarAssistantHeader
          pillar="marketing"
          eyebrow="Marketing"
          title={`${settings.displayName} · Marketing AI`}
          subtitle="Ask in plain language — Maya plans like marketing staff using your CRM, products, and monthly sales"
          action={
            <Link
              href="/marketing"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-colors",
                theme.btnSecondary,
              )}
            >
              Back to Marketing
            </Link>
          }
        />
      }
    >
      <div className={PILLAR_ASSISTANT_BODY}>
        <MayaAssistantChat
          businessId={user.businessId}
          initialSeed={seed}
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
