import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { AiAgentsView } from "@/components/settings/AiAgentsView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadAgentsOverview } from "@/lib/settings/ai-agents";

export const metadata = { title: "AI Agent activation" };
export const dynamic = "force-dynamic";

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
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to settings
      </Link>

      <PageHeader
        eyebrow="Settings · Power features"
        title="AI Agent activation"
        description="Turn agents on or off, set a daily budget, and choose how fast they think. Subscribe to agents in the Marketplace first."
        action={
          <Badge tone="accent">
            {overview.active_count} / {overview.agents.length} active
          </Badge>
        }
      />

      <AiAgentsView initial={overview} canEdit={canEdit} />
    </div>
  );
}
