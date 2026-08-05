import { redirect } from "next/navigation";
import { SettingsPageHero } from "@/components/settings/SettingsPageHero";
import { TeamView } from "@/components/settings/TeamView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { isSaasDeployment } from "@/lib/platform/deployment";
import { loadBusiness } from "@/lib/settings/business";
import {
  countTeamAudit,
  loadTeamAudit,
  loadTeamInvites,
  loadTeamMembers,
  seatQuota,
} from "@/lib/settings/team";

export const metadata = { title: "Team" };
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
  const [members, invites, audit, auditTotal] = await Promise.all([
    loadTeamMembers(user.businessId),
    loadTeamInvites(user.businessId),
    loadTeamAudit(user.businessId, 10),
    countTeamAudit(user.businessId),
  ]);

  const tier = business?.tier ?? "starter";
  const quota = seatQuota(tier);
  const seatUsed = members.length + invites.length;
  const canEdit = user.role === "owner";

  const summaryParts = [
    `${members.length} member${members.length === 1 ? "" : "s"}`,
    invites.length > 0
      ? `${invites.length} invite${invites.length === 1 ? "" : "s"} pending`
      : null,
    quota >= 999
      ? `${seatUsed} seats`
      : `${seatUsed}/${quota} seats`,
  ].filter(Boolean);

  return (
    <>
      <SettingsPageHero
        title="Team"
        subcopy={summaryParts.join(" · ")}
      />

      <TeamView
        members={members}
        invites={invites}
        audit={audit}
        auditTotal={auditTotal}
        seatQuota={quota}
        seatUsed={seatUsed}
        canEdit={canEdit}
        currentUserId={user.id}
        showBillingLink={isSaasDeployment() || user.role === "owner"}
      />
    </>
  );
}
