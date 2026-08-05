import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrOverview } from "@/components/hr/HrOverview";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canAccessStaffMe, canManageHrCore } from "@/lib/hr/access";
import { loadHrDashboard } from "@/lib/hr/load";

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

  const dashboard = await loadHrDashboard(user.businessId);

  return <HrOverview dashboard={dashboard} />;
}
