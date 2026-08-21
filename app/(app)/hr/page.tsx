import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrGuideJourney } from "@/components/hr/HrGuideJourney";
import { HrOverview } from "@/components/hr/HrOverview";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canAccessStaffMe, canManageHrCore } from "@/lib/hr/access";
import { loadContractExpiringForOverview } from "@/lib/hr/contract-reminders";
import { loadHrStaffAppraisals } from "@/lib/hr/load";
import { loadHrDashboardCached } from "@/lib/cache/dashboard-cache";
import {
  hasHrReminderPackAddon,
  hasStaffAppraisalAddon,
} from "@/lib/marketplace/entitlements";

export const metadata = { title: "People & Leave" };
export const dynamic = "force-dynamic";

export default async function HrPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!canManageHrCore(user.role)) {
    if (canAccessStaffMe(user.role)) {
      redirect("/hr/me");
    }
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-ink-muted dark:text-cream-400">
          You do not have access to HR records.
        </CardBody>
      </Card>
    );
  }

  const [appraisalAddonActive, reminderPackActive] = await Promise.all([
    hasStaffAppraisalAddon(user.businessId),
    hasHrReminderPackAddon(user.businessId),
  ]);
  const [dashboard, appraisals, contractExpiring] = await Promise.all([
    loadHrDashboardCached(user.businessId),
    appraisalAddonActive
      ? loadHrStaffAppraisals(user.businessId)
      : Promise.resolve([]),
    reminderPackActive
      ? loadContractExpiringForOverview(user.businessId)
      : Promise.resolve([]),
  ]);

  return (
    <>
      <HrGuideJourney businessId={user.businessId} />
      <HrOverview
        dashboard={dashboard}
        appraisalAddonActive={appraisalAddonActive}
        appraisals={appraisals}
        contractExpiring={contractExpiring}
      />
    </>
  );
}
