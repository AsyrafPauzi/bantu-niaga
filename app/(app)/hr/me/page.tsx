import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { SectionCard } from "@/components/dashboard/section-card";
import { HrLeaveBalanceStrip } from "@/components/hr/HrLeaveBalanceStrip";
import { MeLeaveList } from "@/components/hr/me/MeLeaveList";
import { MeMobileSubnav } from "@/components/hr/me/MeMobileSubnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import {
  buildLeaveBalanceLines,
  countApprovedLeaveDaysByType,
} from "@/lib/hr/leave-balance-display";
import {
  loadHrEmployeeLeaveBalanceSummary,
  loadStaffMeLeaveRecords,
  loadStaffMeOnboardingItems,
} from "@/lib/hr/load";
import { resolveStaffMePage } from "@/lib/hr/staff-self-service";

export const metadata = { title: "My leave" };
export const dynamic = "force-dynamic";

export default async function HrMePage() {
  const ctx = await resolveStaffMePage();
  if (!ctx) return null;

  const { user, employee } = ctx;
  const entitlement =
    employee.annual_leave_entitlement_days != null
      ? employee.annual_leave_entitlement_days
      : 14;

  const [balance, leave, onboarding] = await Promise.all([
    loadHrEmployeeLeaveBalanceSummary(user.businessId, employee.id, entitlement),
    loadStaffMeLeaveRecords(user.businessId, employee.id),
    loadStaffMeOnboardingItems(user.businessId, employee.id),
  ]);

  const onboardingDone = onboarding.filter((item) => item.is_done).length;
  const pendingCount = leave.filter((row) => row.status === "pending").length;
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
          title="My leave"
          subtitle={`${employee.full_name} · ${employee.role_title}`}
          action={
            <Link
              href="/hr/me/leave/new"
              className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-brand-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <CalendarPlus className="h-4 w-4" strokeWidth={2} />
              Apply leave
            </Link>
          }
        />
      }
    >
      <HrPageBody>
        <MeMobileSubnav pathname="/hr/me" />

        <HrLeaveBalanceStrip lines={balanceLines} />

        {onboarding.length > 0 ? (
          <div className="rounded-xl border border-[#E5E0D8] bg-cream-50 px-4 py-3 dark:border-hairline-dark dark:bg-panel-dark/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              Onboarding
            </p>
            <p className="mt-1 text-lg font-bold text-ink dark:text-cream-100">
              {onboardingDone}/{onboarding.length} done
            </p>
            <Link
              href="/hr/me/onboarding"
              className="mt-1 inline-block text-xs font-semibold text-brand-700 dark:text-brand-200"
            >
              View checklist →
            </Link>
          </div>
        ) : null}

        <SectionCard
          title="Recent requests"
          subtitle={
            pendingCount > 0
              ? `${pendingCount} waiting for manager approval`
              : "Your leave history"
          }
          bodyClassName="pt-0"
        >
          <MeLeaveList rows={leave.slice(0, 8)} />
        </SectionCard>
      </HrPageBody>
    </HrPageShell>
  );
}
