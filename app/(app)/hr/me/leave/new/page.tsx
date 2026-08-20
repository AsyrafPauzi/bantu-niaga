import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { MeLeaveRequestForm } from "@/components/hr/me/MeLeaveRequestForm";
import { MeMobileSubnav } from "@/components/hr/me/MeMobileSubnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { resolveStaffMePage } from "@/lib/hr/staff-self-service";
import {
  attachmentRequiredMap,
  enabledLeaveTypeKeys,
  loadHrLeaveTypeSettings,
} from "@/lib/hr/leave-type-settings";
import {
  buildLeaveBalanceLines,
  countApprovedLeaveDaysByType,
} from "@/lib/hr/leave-balance-display";
import {
  loadHrEmployeeLeaveBalanceSummary,
  loadStaffMeLeaveRecords,
} from "@/lib/hr/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Apply leave" };
export const dynamic = "force-dynamic";

export default async function HrMeLeaveNewPage() {
  const ctx = await resolveStaffMePage();
  if (!ctx) return null;

  const { employee, user } = ctx;
  const supabase = await createSupabaseServerClient();
  const leaveSettings = await loadHrLeaveTypeSettings(supabase, user.businessId);
  const attachmentRequired = attachmentRequiredMap(leaveSettings);
  const enabledLeaveTypes = enabledLeaveTypeKeys(leaveSettings);
  const entitlement =
    employee.annual_leave_entitlement_days != null
      ? employee.annual_leave_entitlement_days
      : 14;

  const [balance, leave] = await Promise.all([
    loadHrEmployeeLeaveBalanceSummary(user.businessId, employee.id, entitlement),
    loadStaffMeLeaveRecords(user.businessId, employee.id),
  ]);

  const balanceLines = buildLeaveBalanceLines({
    annual: {
      entitlement: balance.entitlementDays,
      taken: balance.takenDays,
    },
    caps: {
      mc: employee.leave_entitlements?.mc,
      emergency: employee.leave_entitlements?.emergency,
      hospitalisation: employee.leave_entitlements?.hospitalisation,
    },
    usedByType: countApprovedLeaveDaysByType(leave, balance.leaveYear),
  });

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Apply for leave"
          subtitle="Submit annual, emergency, or MC leave for manager approval"
          action={
            <Link
              href="/hr/me"
              className="inline-flex rounded-[10px] border border-hairline-light bg-cream-100 px-3.5 py-2.5 text-[13px] font-semibold text-brand-700 dark:border-hairline-dark dark:bg-panel-dark dark:text-brand-200"
            >
              ← Back
            </Link>
          }
        />
      }
    >
      <HrPageBody>
        <MeMobileSubnav pathname="/hr/me/leave/new" />
        <SectionCard title="Leave request" subtitle="All fields are required unless noted">
          <MeLeaveRequestForm
            employeeName={employee.full_name}
            attachmentRequired={attachmentRequired}
            enabledLeaveTypes={enabledLeaveTypes}
            balanceLines={balanceLines}
          />
        </SectionCard>
      </HrPageBody>
    </HrPageShell>
  );
}
