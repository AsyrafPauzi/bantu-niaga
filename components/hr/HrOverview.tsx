import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  ClipboardCheck,
  Clock,
  Plus,
  UserCheck,
  Users,
} from "lucide-react";
import { HrContractExpiringWidget } from "@/components/hr/HrContractExpiringWidget";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPendingLeaveCard } from "@/components/hr/HrPendingLeaveCard";
import { HrStaffAppraisalGate } from "@/components/hr/HrStaffAppraisalGate";
import { HrTodayDeskPanels } from "@/components/hr/HrTodayDeskPanels";
import { OnboardingProgressBar } from "@/components/hr/HrOnboardingProgress";
import type { HrDashboardData, HrStaffAppraisalRow } from "@/lib/hr/load";
import type { ContractExpiringEmployee } from "@/lib/hr/contract-reminders";
import { appraisalDisplayStatus } from "@/lib/hr/appraisal";
import {
  describeProfileGaps,
  getProfileCompletionGaps,
  isEmployeeProfileIncomplete,
} from "@/lib/hr/profile-completion";
import {
  formatOnboardingProgress,
  onboardingProgressFromCounts,
} from "@/lib/hr/onboarding-progress";
import {
  leaveTypeBadgeClass,
  leaveTypeShort,
} from "@/lib/hr/leave-labels";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";
import { fmtRelTime } from "@/lib/utils/relative-time";

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-MY", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function fmtTodayLabel(): string {
  return new Date().toLocaleDateString("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

function fmtShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
}

function fmtLeaveRange(start: string, end: string): string {
  if (start === end) return fmtShortDate(start);
  return `${fmtShortDate(start)} – ${fmtShortDate(end)}`;
}

function employmentLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export interface HrOverviewProps {
  dashboard: HrDashboardData;
  appraisalAddonActive?: boolean;
  appraisals?: HrStaffAppraisalRow[];
  contractExpiring?: ContractExpiringEmployee[];
}

export function HrOverview({
  dashboard,
  appraisalAddonActive = false,
  appraisals = [],
  contractExpiring = [],
}: HrOverviewProps) {
  const {
    employees,
    leavePending,
    leaveOnToday,
    leaveThisWeek,
    onboarding,
    documents,
    expiringContracts,
    holidays,
    notifications,
    counts,
  } = dashboard;

  const todayYmd = new Date().toISOString().slice(0, 10);
  const recentEmployees = employees.slice(0, 5);
  const nextHolidays = holidays
    .filter((h) => h.holiday_date >= todayYmd)
    .slice(0, 3);

  const profilesToFinish = employees.filter((emp) =>
    isEmployeeProfileIncomplete(emp, documents),
  );

  const teamOnboarding = onboardingProgressFromCounts(
    counts.onboardingDone,
    counts.onboardingTotal,
  );

  const heroHeadline =
    counts.totalEmployees === 0
      ? "Your team starts here"
      : counts.leaveToday > 0
        ? `${counts.leaveToday} away · ${counts.activeEmployees} on deck`
        : `${counts.activeEmployees} active today`;

  const heroSub =
    counts.totalEmployees === 0
      ? "Add your first employee to manage leave, documents, and onboarding."
      : counts.pendingLeave > 0
        ? `${counts.pendingLeave} leave request${counts.pendingLeave === 1 ? "" : "s"} need your decision.`
        : "Team roster, leave, and documents in one place.";

  const showNeedsAttention =
    profilesToFinish.length > 0 ||
    (counts.onboardingTotal > 0 && counts.incompleteOnboarding > 0);

  const appraisalPending = appraisals.filter((row) => row.status !== "completed");
  const appraisalOverdue = appraisalPending.filter(
    (row) => appraisalDisplayStatus(row, todayYmd) === "overdue",
  );

  return (
    <div className="space-y-6">
      <HrMobileSubnav />

      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden rounded-xl border p-4 shadow-sm sm:p-5",
          hrClasses.heroBorder,
          hrClasses.heroBg,
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className={cn("text-[11px] font-semibold uppercase tracking-widest", hrClasses.textMuted)}>
              {greeting()} · {fmtTodayLabel()}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
              {heroHeadline}
            </h1>
            <p className="mt-0.5 max-w-lg text-sm text-ink-muted dark:text-cream-400">
              {heroSub}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/hr/employees/new"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition",
                hrClasses.btnPrimary,
              )}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Add employee
            </Link>
            <Link
              href="/hr/leave/record"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
                hrClasses.btnSecondary,
              )}
            >
              <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2} />
              Record leave
            </Link>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Active staff", value: counts.activeEmployees, sub: `${counts.totalEmployees} total` },
            {
              label: "On leave",
              value: counts.leaveToday,
              sub: "today",
              highlight: counts.leaveToday > 0,
            },
            {
              label: "Pending",
              value: counts.pendingLeave,
              sub: "approvals",
              highlight: counts.pendingLeave > 0,
            },
            { label: "Documents", value: counts.documentCount, sub: "on file" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-cream-200/80 bg-white/90 px-2.5 py-2 dark:border-hairline-dark dark:bg-panel-dark/80"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-500">
                {stat.label}
              </p>
              <p
                className={cn(
                  "text-xl font-bold tabular-nums leading-tight",
                  stat.highlight ? "text-amber-700 dark:text-amber-300" : hrClasses.text,
                )}
              >
                {stat.value}
              </p>
              <p className="text-[10px] text-ink-muted dark:text-cream-500">{stat.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <HrTodayDeskPanels
        leaveOnToday={leaveOnToday}
        leaveThisWeek={leaveThisWeek}
        leavePending={leavePending}
        expiringContracts={
          expiringContracts.length > 0
            ? expiringContracts
            : contractExpiring.map((e) => ({
                id: e.id,
                full_name: e.full_name,
                role_title: e.role_title,
                contract_end_date: e.contract_end_date,
              }))
        }
        incompleteEmployees={profilesToFinish.slice(0, 5).map((emp) => {
          const gaps = getProfileCompletionGaps(emp, documents);
          const missing =
            gaps.missingContactFields.length + gaps.missingDocuments.length;
          const totalSlots = 4 + 3; // contact fields tracked + compulsory docs
          const percent = Math.max(
            0,
            Math.round(((totalSlots - missing) / totalSlots) * 100),
          );
          return {
            id: emp.id,
            full_name: emp.full_name,
            percent,
          };
        })}
      />

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Panel
          title="Team"
          subtitle={`${counts.activeEmployees} active`}
          action={{ href: "/hr/employees", label: "All employees" }}
        >
          {recentEmployees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No employees yet"
              cta={{ href: "/hr/employees/new", label: "Add employee" }}
            />
          ) : (
            <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {recentEmployees.map((emp) => (
                <li key={emp.id}>
                  <Link
                    href={`/hr/employees/${emp.id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 transition hover:bg-teal-50/50 sm:px-4 dark:hover:bg-teal-950/20"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                        {emp.full_name}
                      </p>
                      <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                        {emp.role_title} · {employmentLabel(emp.employment_type)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {showNeedsAttention ? (
          <Panel
            title="Needs attention"
            subtitle="Profiles and onboarding items to finish"
            action={{ href: "/hr/employees", label: "Employees" }}
          >
            <div className="space-y-3 px-3 py-3 sm:px-4">
              {counts.onboardingTotal > 0 && counts.incompleteOnboarding > 0 ? (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-ink-muted dark:text-cream-400">
                      Onboarding · {formatOnboardingProgress(teamOnboarding)}
                    </p>
                  </div>
                  <OnboardingProgressBar progress={teamOnboarding} />
                  {onboarding.length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {onboarding.slice(0, 3).map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate text-ink dark:text-cream-100">
                            {item.label}
                            <span className="text-ink-muted dark:text-cream-400">
                              {" "}
                              · {item.hr_employees?.full_name}
                            </span>
                          </span>
                          <Link href={`/hr/employees/${item.employee_id}`} className={cn("shrink-0 text-xs", hrClasses.link)}>
                            Open
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {profilesToFinish.length > 0 ? (
                <ul className={cn(counts.incompleteOnboarding > 0 && "border-t border-cream-200 pt-3 dark:border-hairline-dark", "space-y-1.5")}>
                  {profilesToFinish.slice(0, 4).map((employee) => {
                    const gaps = getProfileCompletionGaps(employee, documents);
                    return (
                      <li
                        key={employee.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-ink dark:text-cream-100">{employee.full_name}</p>
                          <p className="text-xs text-ink-muted dark:text-cream-400">
                            {describeProfileGaps(gaps)}
                          </p>
                        </div>
                        <Link href={`/hr/employees/${employee.id}`} className={cn("shrink-0 text-xs", hrClasses.link)}>
                          Complete
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </Panel>
        ) : null}

        <Panel
          title="Performance reviews"
          subtitle={
            !appraisalAddonActive
              ? "Staff Appraisal Checker add-on"
              : appraisals.length === 0
                ? "No reviews scheduled"
                : `${appraisals.length - appraisalPending.length} of ${appraisals.length} complete` +
                  (appraisalOverdue.length > 0 ? ` · ${appraisalOverdue.length} overdue` : "")
          }
          action={
            appraisalAddonActive
              ? { href: "/hr/appraisals", label: "Appraisals" }
              : undefined
          }
        >
          {!appraisalAddonActive ? (
            <div className="p-3 sm:p-4">
              <HrStaffAppraisalGate />
            </div>
          ) : appraisals.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No appraisals scheduled"
              cta={{ href: "/hr/appraisals", label: "Schedule review" }}
            />
          ) : (
            <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {appraisalPending.slice(0, 4).map((row) => {
                const displayStatus = appraisalDisplayStatus(row, todayYmd);
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                        {row.hr_employees?.full_name ?? "Employee"}
                      </p>
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        {row.period_label} · due {fmtShortDate(row.due_date)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        displayStatus === "overdue"
                          ? "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                          : "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
                      )}
                    >
                      {displayStatus === "overdue" ? "Overdue" : "Due"}
                    </span>
                  </li>
                );
              })}
              {appraisalPending.length > 4 ? (
                <li className="px-3 py-2 text-center sm:px-4">
                  <Link href="/hr/appraisals" className={cn("text-xs font-semibold", hrClasses.link)}>
                    {appraisalPending.length - 4} more pending
                  </Link>
                </li>
              ) : null}
            </ul>
          )}
        </Panel>

        {nextHolidays.length > 0 ? (
          <Panel
            title="Next holiday"
            subtitle="On your calendar"
            action={{ href: "/hr/holidays", label: "Calendar" }}
          >
            <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {nextHolidays.map((holiday) => {
                const days = daysUntil(holiday.holiday_date);
                return (
                  <li
                    key={holiday.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                        {holiday.name}
                      </p>
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        {fmtShortDate(holiday.holiday_date)}
                      </p>
                    </div>
                    <span className={cn("shrink-0 text-xs font-semibold tabular-nums", hrClasses.text)}>
                      {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : null}
      </div>

      <Panel title="Activity feed" subtitle="Recent HR events for your team" className="mt-4">
        <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-sm text-ink-muted sm:px-4 dark:text-cream-400">
              Employees, leave, and documents will appear here.
            </p>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-3 py-3 sm:px-4"
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                    hrClasses.iconBox,
                  )}
                >
                  <Clock className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink dark:text-cream-100">{item.message}</p>
                  <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                    {fmtRelTime(item.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <div className="pb-16 lg:pb-6" />
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-cream-200 bg-white shadow-sm dark:border-hairline-dark dark:bg-panel-dark",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-cream-200 px-3 py-2 sm:px-4 dark:border-hairline-dark">
        <div>
          <h2 className="text-sm font-semibold leading-tight text-ink dark:text-cream-100">{title}</h2>
          <p className="text-[11px] text-ink-muted dark:text-cream-400">{subtitle}</p>
        </div>
        {action ? (
          <Link href={action.href} className={cn("shrink-0 text-xs", hrClasses.link)}>
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  cta,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center px-3 py-5 text-center sm:px-4">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", hrClasses.iconBox)}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <p className="mt-1.5 text-sm font-medium text-ink-muted dark:text-cream-400">{title}</p>
      {cta ? (
        <Link
          href={cta.href}
          className={cn("mt-3 inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold", hrClasses.btnPrimary)}
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}
