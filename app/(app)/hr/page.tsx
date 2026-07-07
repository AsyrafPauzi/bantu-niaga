import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, Link2, UserPlus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { ListRow } from "@/components/dashboard/list-row";
import { SectionCard } from "@/components/dashboard/section-card";
import { HrActionRow } from "@/components/hr/layout/hr-action-row";
import { HrKpiGrid } from "@/components/hr/layout/hr-kpi-grid";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { AgentNoticeCard } from "@/components/dashboard/agent-notice-card";
import { HrPendingLeaveCard } from "@/components/hr/HrPendingLeaveCard";
import { OnboardingProgressBar } from "@/components/hr/HrOnboardingProgress";
import { KpiTileBig } from "@/components/marketing/dashboard/KpiTileBig";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrDashboard, loadTodayHrNotice } from "@/lib/hr/load";
import { formatOnboardingProgress, onboardingProgressFromCounts } from "@/lib/hr/onboarding-progress";
import {
  describeProfileGaps,
  getProfileCompletionGaps,
  isEmployeeProfileIncomplete,
} from "@/lib/hr/profile-completion";
import {
  hasHrAssistantAddon,
  hasPublicHolidaysAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";

export const metadata = { title: "People & Leave" };
export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${iso}T00:00:00`));
}

function employmentLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function HrPage() {
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
          You do not have access to HR records.
        </CardBody>
      </Card>
    );
  }

  const dashboard = await loadHrDashboard(user.businessId);
  const [addonActive, holidaysAddonActive, agentSettings, hrNotice] = await Promise.all([
    hasHrAssistantAddon(user.businessId),
    hasPublicHolidaysAddon(user.businessId),
    loadBusinessAgentSettings(user.businessId),
    loadTodayHrNotice(user.businessId),
  ]);
  const recentEmployees = dashboard.employees.slice(0, 4);
  const pendingLeave = dashboard.leave.filter((row) => row.status === "pending");
  const nextHolidays = dashboard.holidays
    .filter((holiday) => holiday.holiday_date >= new Date().toISOString().slice(0, 10))
    .slice(0, 3);
  const profilesToFinish = dashboard.employees.filter((employee) =>
    isEmployeeProfileIncomplete(employee, dashboard.documents),
  );
  const incompleteProfiles = profilesToFinish.slice(0, 5);
  const teamOnboarding = onboardingProgressFromCounts(
    dashboard.counts.onboardingDone,
    dashboard.counts.onboardingTotal,
  );

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="People & Leave"
          subtitle="Manage your team, leave, and documents in one place"
          helpHref="/more"
          action={
            <Link
              href="/hr/employees/new"
              className="inline-flex items-center justify-center rounded-[10px] bg-brand-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
            >
              + Add employee
            </Link>
          }
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />

        {addonActive && agentSettings.dailyNoticeEnabled && hrNotice ? (
          <div className="mb-4">
            <AgentNoticeCard
              title={hrNotice.title}
              body={hrNotice.body}
              assistantName={agentSettings.displayName}
            />
          </div>
        ) : null}

        <HrKpiGrid>
          <KpiTileBig
            label="Active staff"
            value={String(dashboard.counts.activeEmployees)}
            sublabel="currently working"
            tone="brand"
          />
          <KpiTileBig
            label="On leave today"
            value={String(dashboard.counts.leaveToday)}
            sublabel="approved leave"
            tone="accent"
          />
          <KpiTileBig
            label="Needs approval"
            value={String(dashboard.counts.pendingLeave)}
            sublabel="waiting for you"
            tone={dashboard.counts.pendingLeave > 0 ? "warning" : "success"}
          />
          <KpiTileBig
            label="Profiles to finish"
            value={String(profilesToFinish.length)}
            sublabel="missing contact, bank, or compulsory docs"
            tone={profilesToFinish.length > 0 ? "info" : "success"}
          />
          <KpiTileBig
            label="Onboarding"
            value={
              dashboard.counts.onboardingTotal === 0
                ? "—"
                : dashboard.counts.incompleteOnboarding === 0
                  ? "Done"
                  : `${dashboard.counts.onboardingDone}/${dashboard.counts.onboardingTotal}`
            }
            sublabel={
              dashboard.counts.onboardingTotal === 0
                ? "no checklist items yet"
                : formatOnboardingProgress(teamOnboarding)
            }
            tone={
              dashboard.counts.onboardingTotal > 0 &&
              dashboard.counts.incompleteOnboarding === 0
                ? "success"
                : dashboard.counts.incompleteOnboarding > 0
                  ? "info"
                  : "brand"
            }
          />
        </HrKpiGrid>

        {profilesToFinish.length > 0 ? (
          <SectionCard
            title="Profiles to finish"
            subtitle="Active staff missing contact details or compulsory documents (IC, bank, contract)"
            bodyClassName="space-y-3"
          >
            {incompleteProfiles.map((employee) => {
              const gaps = getProfileCompletionGaps(employee, dashboard.documents);
              return (
                <div
                  key={employee.id}
                  className="flex flex-col gap-2 rounded-xl border border-[#E5E0D8] p-4 dark:border-hairline-dark sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink dark:text-cream-100">
                      {employee.full_name}
                    </p>
                    <p className="text-xs text-ink-muted dark:text-cream-400">
                      {describeProfileGaps(gaps)}
                    </p>
                  </div>
                  <Link
                    href={`/hr/employees/${employee.id}`}
                    className="shrink-0 text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
                  >
                    Complete profile →
                  </Link>
                </div>
              );
            })}
            {profilesToFinish.length > incompleteProfiles.length ? (
              <p className="text-center text-xs text-ink-muted dark:text-cream-400">
                +{profilesToFinish.length - incompleteProfiles.length} more on{" "}
                <Link href="/hr/employees" className="font-semibold text-brand-700">
                  Employees
                </Link>
              </p>
            ) : null}
          </SectionCard>
        ) : null}

        {dashboard.counts.onboardingTotal > 0 ? (
          <SectionCard
            title="Onboarding checklist"
            subtitle={formatOnboardingProgress(teamOnboarding)}
            bodyClassName="space-y-4"
          >
            <OnboardingProgressBar progress={teamOnboarding} />
            {dashboard.onboarding.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Still to do
                </p>
                {dashboard.onboarding.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E0D8] px-3 py-2 dark:border-hairline-dark"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink dark:text-cream-100">
                        {item.label}
                      </p>
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        {item.hr_employees?.full_name ?? "Employee"}
                      </p>
                    </div>
                    <Link
                      href={`/hr/employees/${item.employee_id}`}
                      className="text-xs font-semibold text-brand-700 dark:text-brand-200"
                    >
                      Open →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted dark:text-cream-400">
                Every checklist item is marked done.
              </p>
            )}
          </SectionCard>
        ) : null}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <SectionCard
            title="Your to-do today"
            subtitle="Leave requests waiting for your decision"
            bodyClassName="space-y-3"
          >
            {pendingLeave.length === 0 ? (
              <p className="text-sm text-ink-muted dark:text-cream-400">
                No pending leave records.
              </p>
            ) : (
              pendingLeave.slice(0, 4).map((row) => (
                <HrPendingLeaveCard key={row.id} row={row} />
              ))
            )}
          </SectionCard>

          <div className="flex flex-col gap-4">
            <SectionCard
              title="Your team"
              subtitle={`${dashboard.counts.activeEmployees} people on your payroll`}
              bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
            >
              {recentEmployees.length === 0 ? (
                <p className="text-sm text-ink-muted dark:text-cream-400">
                  Add your first employee to start HR records.
                </p>
              ) : (
                recentEmployees.map((employee) => (
                  <ListRow
                    key={employee.id}
                    initials={employee.full_name.slice(0, 2)}
                    title={employee.full_name}
                    subtitle={`${employee.role_title} · ${employmentLabel(employee.employment_type)}`}
                    value={employee.status.replace(/_/g, " ")}
                  />
                ))
              )}
              <div className="pt-3 text-center">
                <Link
                  href="/hr/employees"
                  className="text-[13px] font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
                >
                  View all →
                </Link>
              </div>
            </SectionCard>

            {holidaysAddonActive ? (
              <SectionCard
                title="Upcoming public holidays"
                subtitle="Plan leave around these dates"
                bodyClassName="space-y-1"
              >
                {nextHolidays.length === 0 ? (
                  <p className="text-sm text-ink-muted dark:text-cream-400">
                    No upcoming holidays.{" "}
                    <Link href="/hr/holidays" className="font-semibold text-brand-700">
                      Add holidays
                    </Link>
                  </p>
                ) : (
                  nextHolidays.map((holiday) => (
                    <div
                      key={holiday.id}
                      className="flex items-center justify-between py-1.5 text-sm"
                    >
                      <span className="font-medium text-ink dark:text-cream-100">
                        {holiday.name}
                      </span>
                      <span className="text-xs text-ink-muted dark:text-cream-400">
                        {fmtDate(holiday.holiday_date)}
                      </span>
                    </div>
                  ))
                )}
              </SectionCard>
            ) : (
              <SectionCard
                title="Public holidays"
                subtitle="Free add-on — Malaysian holiday calendar"
                bodyClassName="space-y-2"
              >
                <p className="text-sm text-ink-muted dark:text-cream-400">
                  Activate the Public Holiday Calendar to track federal and state
                  holidays. Hana will include upcoming holidays in daily notices.
                </p>
                <Link
                  href="/marketplace"
                  className="inline-flex text-[13px] font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
                >
                  Activate in Marketplace →
                </Link>
              </SectionCard>
            )}
          </div>
        </div>

        <SectionCard
          title="What would you like to do?"
          subtitle="Pick a task to get started quickly"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <HrActionRow
              href="/hr/employees/new"
              title="Add a new employee"
              helper="Profile, contact, bank details, and documents"
              icon={UserPlus}
              tone="brand"
            />
            <HrActionRow
              href="/hr/leave/record"
              title="Record someone's leave"
              helper="Annual leave, sick leave, or emergency"
              icon={CalendarPlus}
              tone="accent"
            />
            <HrActionRow
              href="/hr/employees"
              title="Share a leave form"
              helper="Let staff request leave themselves"
              icon={Link2}
              tone="neutral"
            />
          </div>
        </SectionCard>
      </HrPageBody>
    </HrPageShell>
  );
}
