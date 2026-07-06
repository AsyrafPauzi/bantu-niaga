import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartHandshake,
  Plus,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { ListRow } from "@/components/dashboard/list-row";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { DashboardSection } from "@/components/marketing/dashboard/DashboardSection";
import { KpiTileBig } from "@/components/marketing/dashboard/KpiTileBig";
import { HrHolidayCreateForm } from "@/components/hr/HrHolidayCreateForm";
import { HrOnboardingCreateForm } from "@/components/hr/HrOnboardingCreateForm";
import { HrOnboardingStatusActions } from "@/components/hr/HrOnboardingStatusActions";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrDashboard } from "@/lib/hr/load";

export const metadata = { title: "HR" };
export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${iso}T00:00:00`));
}

const QUICK_ACTIONS = [
  {
    href: "/hr/employees",
    label: "Add employee",
    helper: "Staff profile",
    icon: UserPlus,
    tone:
      "border-brand-500 bg-brand-500 text-white hover:bg-brand-600 hover:border-brand-600",
  },
  {
    href: "/hr/leave",
    label: "Record leave",
    helper: "AL · emergency · MC",
    icon: CalendarPlus,
    tone:
      "border-accent-500 bg-accent-500 text-white hover:bg-accent-600 hover:border-accent-600",
  },
  {
    href: "/hr/employees#documents",
    label: "Upload HR doc",
    helper: "Admin Storage sync",
    icon: Upload,
    tone:
      "border-brand-100 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:border-brand-900/60 dark:bg-brand-900/30 dark:text-brand-200",
  },
  {
    href: "/hr/employees",
    label: "Leave link",
    helper: "24-hour staff link",
    icon: HeartHandshake,
    tone:
      "border-cream-300 bg-cream-100 text-ink hover:bg-cream-200 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
  },
];

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
  const recentEmployees = dashboard.employees.slice(0, 4);
  const pendingLeave = dashboard.leave.filter((row) => row.status === "pending");
  const nextHolidays = dashboard.holidays
    .filter((holiday) => holiday.holiday_date >= new Date().toISOString().slice(0, 10))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-cream-50 to-accent-50 p-5 shadow-card sm:p-6 dark:border-brand-900/60 dark:from-brand-900/40 dark:via-panel-dark dark:to-accent-700/20">
        <div
          aria-hidden="true"
          className="absolute -right-12 -top-10 h-44 w-44 rounded-full bg-brand-500/10 blur-3xl dark:bg-brand-400/10"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-10 -left-12 h-32 w-32 rounded-full bg-accent-500/15 blur-3xl dark:bg-accent-500/20"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-200">
              <Users className="h-3.5 w-3.5" strokeWidth={2.25} />
              HR dashboard
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl dark:text-cream-100">
              Keep staff records, leave, and documents{" "}
              <span className="text-brand-700 underline decoration-accent-500 decoration-[3px] underline-offset-[6px] dark:text-brand-200">
                organized
              </span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-muted dark:text-cream-400">
              {dashboard.counts.activeEmployees} active staff ·{" "}
              {dashboard.counts.pendingLeave} pending leave ·{" "}
              {dashboard.documents.length} HR document records
            </p>
          </div>
          <Link
            href="/hr/employees"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            Add employee
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:gap-4">
        <KpiTileBig
          label="Active staff"
          value={String(dashboard.counts.activeEmployees)}
          sublabel="current employee profiles"
          tone="brand"
        />
        <KpiTileBig
          label="On leave today"
          value={String(dashboard.counts.leaveToday)}
          sublabel="approved leave records"
          tone="accent"
        />
        <KpiTileBig
          label="Pending leave"
          value={String(dashboard.counts.pendingLeave)}
          sublabel="waiting for approval"
          tone={dashboard.counts.pendingLeave > 0 ? "warning" : "success"}
        />
        <KpiTileBig
          label="Onboarding"
          value={String(dashboard.counts.incompleteOnboarding)}
          sublabel="open checklist items"
          tone={dashboard.counts.incompleteOnboarding > 0 ? "info" : "success"}
        />
      </section>

      <section className="flex w-full snap-x snap-mandatory items-stretch gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {QUICK_ACTIONS.map(({ href, label, helper, icon: Icon, tone }) => (
          <Link
            key={label}
            href={href}
            className={`inline-flex shrink-0 snap-start items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium shadow-card transition-colors ${tone}`}
          >
            <Icon className="h-4 w-4" strokeWidth={2.25} />
            <span>
              {label}
              <span className="ml-1 hidden text-xs opacity-75 sm:inline">
                {helper}
              </span>
            </span>
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr] lg:gap-6">
        <SectionCard
          title="Pending leave approvals"
          subtitle="Annual leave, emergency leave, and MC"
          action={
            <StatusPill tone={pendingLeave.length ? "warning" : "success"}>
              {String(pendingLeave.length)}
            </StatusPill>
          }
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
        >
          {pendingLeave.length === 0 ? (
            <p className="py-6 text-sm text-ink-muted dark:text-cream-400">
              No pending leave records.
            </p>
          ) : (
            pendingLeave.slice(0, 4).map((row) => (
              <ListRow
                key={row.id}
                initials={row.hr_employees?.full_name?.slice(0, 2) ?? "HR"}
                title={row.hr_employees?.full_name ?? "Employee"}
                subtitle={`${row.leave_type.replace(/_/g, " ")} · ${fmtDate(row.start_date)} to ${fmtDate(row.end_date)}`}
                value="Pending"
              />
            ))
          )}
        </SectionCard>

        <DashboardSection
          title="Recent employees"
          subtitle="Latest profiles added to HR"
          action={
            <Link href="/hr/employees" className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200">
              View all
            </Link>
          }
          accent
        >
          <Card>
            <CardBody className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {recentEmployees.length === 0 ? (
                <p className="py-6 text-sm text-ink-muted dark:text-cream-400">
                  Add your first employee to start HR records.
                </p>
              ) : (
                recentEmployees.map((employee) => (
                  <ListRow
                    key={employee.id}
                    initials={employee.full_name.slice(0, 2)}
                    title={employee.full_name}
                    subtitle={`${employee.role_title} · ${employee.employment_type.replace(/_/g, " ")}`}
                    value={employee.status}
                  />
                ))
              )}
            </CardBody>
          </Card>
        </DashboardSection>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <DashboardSection
          title="Onboarding checklist"
          subtitle="Track IC collected, bank details, uniform, and SOP briefing."
          accent
        >
          <Card>
            <CardBody className="space-y-4">
              <HrOnboardingCreateForm employees={dashboard.employees} />
              <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
                {dashboard.onboarding.length === 0 ? (
                  <p className="py-4 text-sm text-ink-muted dark:text-cream-400">
                    No open onboarding checklist items.
                  </p>
                ) : (
                  dashboard.onboarding.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink dark:text-cream-100">
                          {item.label}
                        </p>
                        <p className="text-xs text-ink-muted dark:text-cream-400">
                          {item.hr_employees?.full_name ?? "Employee"}
                        </p>
                      </div>
                      <HrOnboardingStatusActions
                        itemId={item.id}
                        isDone={item.is_done}
                      />
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>
        </DashboardSection>

        <DashboardSection
          title="Public holiday calendar"
          subtitle="Business-specific public holidays used by HR leave planning."
          accent
        >
          <Card>
            <CardBody className="space-y-4">
              <HrHolidayCreateForm />
              <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
                {nextHolidays.length === 0 ? (
                  <p className="py-4 text-sm text-ink-muted dark:text-cream-400">
                    No upcoming public holidays recorded.
                  </p>
                ) : (
                  nextHolidays.map((holiday) => (
                    <div
                      key={holiday.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink dark:text-cream-100">
                          {holiday.name}
                        </p>
                        <p className="text-xs text-ink-muted dark:text-cream-400">
                          {holiday.state_code ?? "All states"}
                        </p>
                      </div>
                      <span className="rounded-full bg-cream-100 px-2 py-1 text-xs font-semibold text-ink-muted dark:bg-hairline-dark dark:text-cream-400">
                        {fmtDate(holiday.holiday_date)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>
        </DashboardSection>
      </div>
    </div>
  );
}
