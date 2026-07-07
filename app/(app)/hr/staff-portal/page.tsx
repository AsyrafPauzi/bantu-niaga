import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrStaffPortalGate } from "@/components/hr/HrStaffPortalGate";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";

export const metadata = { title: "Staff portal" };
export const dynamic = "force-dynamic";

export default async function HrStaffPortalPage() {
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
          You do not have access to staff portal settings.
        </CardBody>
      </Card>
    );
  }

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Staff portal"
          subtitle="Staff login for leave balance and self-service requests"
          helpHref="/more"
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />
        <HrStaffPortalGate />
      </HrPageBody>
    </HrPageShell>
  );
}
