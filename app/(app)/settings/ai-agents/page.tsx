import { redirect } from "next/navigation";
import { SettingsPageHero } from "@/components/settings/SettingsPageHero";
import { AiAgentsView } from "@/components/settings/AiAgentsView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadAgentsOverview } from "@/lib/settings/ai-agents";

export const metadata = { title: "AI agents" };
export const dynamic = "force-dynamic";

function buildDescription(
  overview: Awaited<ReturnType<typeof loadAgentsOverview>>,
): string {
  if (overview.subscribed_agent_count === 0) {
    return "Subscribe to agents in the Marketplace to get started.";
  }

  const parts = [
    `${overview.active_count} active`,
    `${overview.credit_balance} credits left`,
  ];

  if (overview.total_spent_today_credits > 0) {
    parts.push(`${overview.total_spent_today_credits} used today`);
  }

  return parts.join(" · ");
}

export default async function AiAgentSettingsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const overview = await loadAgentsOverview(user.businessId);
  const canEdit = user.role === "owner";

  return (
    <>
      <SettingsPageHero
        title="AI agents"
        subcopy={buildDescription(overview)}
      />

      <AiAgentsView initial={overview} canEdit={canEdit} />
    </>
  );
}
