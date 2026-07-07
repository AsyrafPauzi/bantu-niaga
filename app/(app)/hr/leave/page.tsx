import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, FileCheck, Link2, UserCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { SectionCard } from "@/components/dashboard/section-card";
import { HrActionRow } from "@/components/hr/layout/hr-action-row";
import { HrLeaveRecordRow } from "@/components/hr/HrLeaveRecordRow";
import { HrPendingLeaveCard } from "@/components/hr/HrPendingLeaveCard";
import { HrKpiGrid } from "@/components/hr/layout/hr-kpi-grid";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { KpiTileBig } from "@/components/marketing/dashboard/KpiTileBig";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrLeaveRecords } from "@/lib/hr/load";
import {
  HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG,
  HR_STAFF_PORTAL_ADDON_SLUG,
} from "@/lib/marketplace/agent-types";
import { loadAddonFeatureStates } from "@/lib/marketplace/addon-availability";

export const metadata = { title: "Leave" };
export const dynamic = "force-dynamic";

export default async function LeavePage() {
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
          You do not have access to leave records.
        </CardBody>
      </Card>
    );
  }

  const leave = await loadHrLeaveRecords(user.businessId);
  const addonStates = await loadAddonFeatureStates(user.businessId, [
    HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG,
    HR_STAFF_PORTAL_ADDON_SLUG,
  ]);
  const leavePolicy = addonStates[HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG];
  const staffPortal = addonStates[HR_STAFF_PORTAL_ADDON_SLUG];
  const today = new Date().toISOString().slice(0, 10);
  const pending = leave.filter((row) => row.status === "pending");
  const approvedThisMonth = leave.filter((row) => {
    if (row.status !== "approved") return false;
    const month = row.start_date.slice(0, 7);
    return month === today.slice(0, 7);
  });
  const mcCount = leave.filter((row) => row.leave_type === "mc").length;
  const onLeaveToday = leave.filter(
    (row) =>
      row.status === "approved" &&
      row.start_date <= today &&
      row.end_date >= today,
  ).length;
  const recentApproved = leave
    .filter((row) => row.status === "approved")
    .slice(0, 5);

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Leave"
          subtitle="Record and approve time off for your team"
          helpHref="/more"
          action={
            <Link
              href="/hr/leave/record"
              className="inline-flex items-center justify-center rounded-[10px] bg-brand-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Record leave
            </Link>
          }
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />

        <HrKpiGrid>
          <KpiTileBig
            label="Pending"
            value={String(pending.length)}
            sublabel="needs your decision"
            tone={pending.length > 0 ? "warning" : "success"}
          />
          <KpiTileBig
            label="Approved"
            value={String(approvedThisMonth.length)}
            sublabel="this month"
            tone="brand"
          />
          <KpiTileBig
            label="Sick notes"
            value={String(mcCount)}
            sublabel="on file"
            tone="accent"
          />
          <KpiTileBig
            label="On leave today"
            value={String(onLeaveToday)}
            sublabel="staff away"
            tone="info"
          />
        </HrKpiGrid>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <HrActionRow
            href="/hr/leave/record"
            title="Record leave"
            helper="Annual leave, sick leave, or emergency"
            icon={CalendarPlus}
            tone="accent"
          />
          <HrActionRow
            href="/hr/employees"
            title="Share leave form"
            helper="Send a private WhatsApp link"
            icon={Link2}
            tone="brand"
          />
          <HrActionRow
            href={
              leavePolicy.accessible
                ? "/hr/leave/policy"
                : leavePolicy.purchasable
                  ? "/hr/leave/policy"
                  : undefined
            }
            disabled={leavePolicy.navDisabled}
            badge={leavePolicy.navDisabled ? "Coming soon" : undefined}
            title="Advanced leave policy"
            helper={
              leavePolicy.navDisabled
                ? "Carry-forward and rules — launching in Marketplace soon"
                : leavePolicy.accessible
                  ? "Carry-forward, caps, and custom rules"
                  : "Carry-forward and rules (add-on)"
            }
            icon={FileCheck}
            tone="neutral"
          />
          <HrActionRow
            href={
              staffPortal.accessible
                ? "/hr/staff-portal"
                : staffPortal.purchasable
                  ? "/hr/staff-portal"
                  : undefined
            }
            disabled={staffPortal.navDisabled}
            badge={staffPortal.navDisabled ? "Coming soon" : undefined}
            title="Staff portal"
            helper={
              staffPortal.navDisabled
                ? "Staff self-service login — launching in Marketplace soon"
                : staffPortal.accessible
                  ? "Staff login for leave balance and requests"
                  : "Staff login for leave (add-on)"
            }
            icon={UserCircle}
            tone="neutral"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <SectionCard
            title="Waiting for your approval"
            subtitle="Say yes or no to these leave requests"
            bodyClassName="space-y-3"
          >
            {pending.length === 0 ? (
              <p className="text-sm text-ink-muted dark:text-cream-400">
                No pending leave requests.
              </p>
            ) : (
              pending.map((row) => <HrPendingLeaveCard key={row.id} row={row} />)
            )}
          </SectionCard>

          <SectionCard
            title="Recently approved leave"
            subtitle="Leave records from the past few weeks"
            bodyClassName="space-y-1"
          >
            {recentApproved.length === 0 ? (
              <p className="text-sm text-ink-muted dark:text-cream-400">
                No approved leave yet.
              </p>
            ) : (
              recentApproved.map((row) => (
                <HrLeaveRecordRow key={row.id} row={row} />
              ))
            )}
            <div className="pt-3 text-center">
              <Link
                href="/hr/leave/history"
                className="text-[13px] font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
              >
                View all leave history →
              </Link>
            </div>
          </SectionCard>
        </div>
      </HrPageBody>
    </HrPageShell>
  );
}
