import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrAdvancedLeavePolicyGate } from "@/components/hr/HrAdvancedLeavePolicyGate";
import { HrLeaveTypeSettingsPanel } from "@/components/hr/HrLeaveTypeSettingsPanel";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrLeaveTypeSettings } from "@/lib/hr/leave-type-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const supabase = await createSupabaseServerClient();
  const leaveSettings = await loadHrLeaveTypeSettings(supabase, user.businessId);

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Leave policy"
          subtitle="Default quotas and attachment rules for each leave type"
          helpHref="/more"
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />
        <HrLeaveTypeSettingsPanel initialSettings={leaveSettings} />
        <div className="mt-6">
          <HrAdvancedLeavePolicyGate />
        </div>
      </HrPageBody>
    </HrPageShell>
  );
}
