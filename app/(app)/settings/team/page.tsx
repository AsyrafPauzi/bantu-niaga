import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { TeamView } from "@/components/settings/TeamView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadBusiness } from "@/lib/settings/business";
import { tierBy } from "@/lib/settings/plans";
import {
  loadTeamAudit,
  loadTeamInvites,
  loadTeamMembers,
  seatQuota,
} from "@/lib/settings/team";

export const metadata = { title: "Team & roles" };
export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const business = await loadBusiness(user.businessId);
  const [members, invites, audit] = await Promise.all([
    loadTeamMembers(user.businessId),
    loadTeamInvites(user.businessId),
    loadTeamAudit(user.businessId),
  ]);

  const tier = business?.tier ?? "starter";
  const quota = seatQuota(tier);
  const seatUsed = members.length + invites.length;
  const tierLabel = tierBy(tier)?.label ?? tier;
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
        eyebrow="Settings · Workspace"
        title="Team & roles"
        description="Invite staff, assign roles, revoke access, and review who can see what."
      />

      <TeamView
        members={members}
        invites={invites}
        audit={audit}
        seatQuota={quota}
        seatUsed={seatUsed}
        canEdit={canEdit}
        currentUserId={user.id}
        tierLabel={tierLabel}
      />
    </div>
  );
}
