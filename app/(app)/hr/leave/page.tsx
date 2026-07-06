import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, Link2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { SectionCard } from "@/components/dashboard/section-card";
import { HrActionRow } from "@/components/hr/layout/hr-action-row";
import { HrKpiGrid } from "@/components/hr/layout/hr-kpi-grid";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { HrLeaveStatusActions } from "@/components/hr/HrLeaveStatusActions";
import { KpiTileBig } from "@/components/marketing/dashboard/KpiTileBig";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrLeaveRecords } from "@/lib/hr/load";

export const metadata = { title: "Leave" };
export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

function leaveTypeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
              pending.map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-[#E5E0D8] p-4 dark:border-hairline-dark"
                >
                  <p className="text-sm font-semibold text-ink dark:text-cream-100">
                    {row.hr_employees?.full_name ?? "Employee"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                    {leaveTypeLabel(row.leave_type)} · {fmtDate(row.start_date)}
                    {row.end_date !== row.start_date
                      ? ` – ${fmtDate(row.end_date)}`
                      : ""}
                  </p>
                  <div className="mt-3">
                    <HrLeaveStatusActions leaveId={row.id} />
                  </div>
                </div>
              ))
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
                <div key={row.id} className="border-b border-cream-200 py-2.5 last:border-0 dark:border-hairline-dark">
                  <p className="text-sm font-semibold text-ink dark:text-cream-100">
                    {row.hr_employees?.full_name ?? "Employee"}
                  </p>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    {leaveTypeLabel(row.leave_type)} · {fmtDate(row.start_date)}
                  </p>
                </div>
              ))
            )}
            <div className="pt-3 text-center">
              <span className="text-[13px] font-semibold text-brand-700 dark:text-brand-200">
                View all leave history →
              </span>
            </div>
          </SectionCard>
        </div>
      </HrPageBody>
    </HrPageShell>
  );
}
