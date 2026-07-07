import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrAdvancedLeavePolicyGate } from "@/components/hr/HrAdvancedLeavePolicyGate";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG } from "@/lib/marketplace/agent-types";
import { loadAddonFeatureState } from "@/lib/marketplace/addon-availability";

export const metadata = { title: "Leave policy" };
export const dynamic = "force-dynamic";

export default async function HrLeavePolicyPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!canManageHrCore(user.role)) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-ink-muted dark:text-cream-400">
          You do not have access to leave policy settings.
        </CardBody>
      </Card>
    );
  }

  const policyState = await loadAddonFeatureState(
    user.businessId,
    HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG,
  );
  if (policyState.navDisabled) {
    redirect("/hr/leave");
  }

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Leave policy"
          subtitle="Advanced rules beyond the free annual leave balance"
          helpHref="/more"
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />
        <HrAdvancedLeavePolicyGate />
      </HrPageBody>
    </HrPageShell>
  );
}
