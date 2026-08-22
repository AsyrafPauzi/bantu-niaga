import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { MeLeaveRequestForm } from "@/components/hr/me/MeLeaveRequestForm";
import { MePageFrame } from "@/components/hr/me/MePageFrame";
import { resolveStaffMePage } from "@/lib/hr/staff-self-service";
import {
  attachmentRequiredMap,
  employeeEntitlementDays,
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
    employeeEntitlementDays("annual", employee, leaveSettings) ?? 14;

  const quotaByType = {
    annual: entitlement,
    mc: employeeEntitlementDays("mc", employee, leaveSettings),
    emergency: employeeEntitlementDays("emergency", employee, leaveSettings),
    hospitalisation: employeeEntitlementDays(
      "hospitalisation",
      employee,
      leaveSettings,
    ),
    unpaid: null as number | null,
  };

  const selectableLeaveTypes = enabledLeaveTypes.filter((key) => {
    if (key === "unpaid") return true;
    const q = quotaByType[key];
    return typeof q === "number" && Number.isFinite(q);
  });

  const [balance, leave] = await Promise.all([
    loadHrEmployeeLeaveBalanceSummary(
      user.businessId,
      employee.id,
      entitlement,
    ),
    loadStaffMeLeaveRecords(user.businessId, employee.id),
  ]);

  const balanceLines = buildLeaveBalanceLines({
    annual: {
      entitlement: balance.entitlementDays,
      taken: balance.takenDays,
    },
    caps: {
      mc: quotaByType.mc ?? undefined,
      emergency: quotaByType.emergency ?? undefined,
      hospitalisation: quotaByType.hospitalisation ?? undefined,
    },
    usedByType: countApprovedLeaveDaysByType(leave, balance.leaveYear),
  });

  const configuredLines = balanceLines.filter((l) => l.entitlement != null);
  const heroStats = configuredLines.slice(0, 4);

  return (
    <MePageFrame
      pathname="/hr/me/leave/new"
      title="Apply for leave"
      subtitle="Pick dates and submit — your manager will review"
      stats={
        heroStats.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {heroStats.map((line) => (
              <ModuleHeroStat
                key={line.key}
                label={line.label}
                value={`${line.remaining ?? 0} left`}
                hint={`${line.used ?? 0} used of ${line.entitlement}`}
                pillar="hr"
                iconClassName="text-[#0F766E] dark:text-teal-300"
              />
            ))}
          </div>
        ) : undefined
      }
    >
      <MeLeaveRequestForm
        employeeName={employee.full_name}
        attachmentRequired={attachmentRequired}
        enabledLeaveTypes={enabledLeaveTypes}
        selectableLeaveTypes={selectableLeaveTypes}
        balanceLines={balanceLines}
      />
    </MePageFrame>
  );
}
