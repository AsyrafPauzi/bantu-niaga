import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { HrMeOverview } from "@/components/hr/me/HrMeOverview";
import { HrMeSubpageShell } from "@/components/hr/me/HrMeSubpageShell";
import { MeLeaveRequestsPanel } from "@/components/hr/me/MeLeaveRequestsPanel";
import {
  buildLeaveBalanceLines,
  countApprovedLeaveDaysByType,
} from "@/lib/hr/leave-balance-display";
import {
  loadHrEmployeeLeaveBalanceSummary,
  loadStaffMeLeaveRecords,
  loadStaffMeLeaveRecordsPage,
  loadStaffMeOnboardingItems,
  type StaffMeLeaveStatusFilter,
} from "@/lib/hr/load";
import {
  employeeEntitlementDays,
  loadHrLeaveTypeSettings,
} from "@/lib/hr/leave-type-settings";
import { resolveStaffMePage } from "@/lib/hr/staff-self-service";
import { ADMIN_DEFAULT_PAGE_SIZE, parsePagination } from "@/lib/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "My HR" };
export const dynamic = "force-dynamic";

function parseStatus(
  raw: string | string[] | undefined,
): StaffMeLeaveStatusFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (
    value === "pending" ||
    value === "approved" ||
    value === "rejected"
  ) {
    return value;
  }
  return "all";
}

export default async function HrMePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await resolveStaffMePage();
  if (!ctx) return null;

  const { user, employee } = ctx;
  const params = await searchParams;
  const pagination = parsePagination(params, {
    defaultPageSize: ADMIN_DEFAULT_PAGE_SIZE,
  });
  const statusFilter = parseStatus(params.status);

  const supabase = await createSupabaseServerClient();
  const leaveSettings = await loadHrLeaveTypeSettings(supabase, user.businessId);

  const entitlement =
    employeeEntitlementDays("annual", employee, leaveSettings) ?? 14;

  const [balance, leaveForBalance, leavePage, onboarding] = await Promise.all([
    loadHrEmployeeLeaveBalanceSummary(
      user.businessId,
      employee.id,
      entitlement,
    ),
    loadStaffMeLeaveRecords(user.businessId, employee.id),
    loadStaffMeLeaveRecordsPage(user.businessId, employee.id, {
      status: statusFilter,
      from: pagination.from,
      to: pagination.to,
    }),
    loadStaffMeOnboardingItems(user.businessId, employee.id),
  ]);

  const balanceLines = buildLeaveBalanceLines({
    annual: {
      entitlement: balance.entitlementDays,
      taken: balance.takenDays,
    },
    caps: {
      mc: employeeEntitlementDays("mc", employee, leaveSettings) ?? undefined,
      emergency:
        employeeEntitlementDays("emergency", employee, leaveSettings) ??
        undefined,
      hospitalisation:
        employeeEntitlementDays("hospitalisation", employee, leaveSettings) ??
        undefined,
    },
    usedByType: countApprovedLeaveDaysByType(
      leaveForBalance,
      balance.leaveYear,
    ),
  });

  const pendingCount = leaveForBalance.filter(
    (r) => r.status === "pending",
  ).length;
  const annualLine = balanceLines.find((l) => l.key === "annual");
  const onboardingDone = onboarding.filter((i) => i.is_done).length;
  const onboardingOpen = Math.max(0, onboarding.length - onboardingDone);
  const firstName = employee.full_name.trim().split(/\s+/)[0] || employee.full_name;

  return (
    <HrMeSubpageShell
      pathname="/hr/me"
      showBack={false}
      headline={`Hi ${firstName}`}
      subcopy={`${employee.full_name} · ${employee.role_title}`}
      action={
        <Link
          href="/hr/me/leave/new"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white",
            hrClasses.btnPrimary,
          )}
        >
          <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2} />
          Apply leave
        </Link>
      }
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="Annual left"
            value={annualLine?.remaining ?? "—"}
            pillar="hr"
            iconClassName="text-[#0F766E] dark:text-teal-300"
          />
          <ModuleHeroStat
            label="Pending leave"
            value={pendingCount}
            pillar="hr"
            iconClassName="text-amber-700 dark:text-amber-300"
          />
          <ModuleHeroStat
            label="Onboarding open"
            value={onboardingOpen}
            pillar="hr"
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Requests"
            value={leaveForBalance.length}
            pillar="hr"
            iconClassName="text-ink-muted dark:text-cream-400"
          />
        </div>
      }
    >
      <HrMeOverview
        balanceLines={balanceLines}
        pendingCount={pendingCount}
        onboarding={onboarding}
        leavePanel={
          <MeLeaveRequestsPanel
            rows={leavePage.rows}
            statusFilter={statusFilter}
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={leavePage.total}
          />
        }
      />
    </HrMeSubpageShell>
  );
}
