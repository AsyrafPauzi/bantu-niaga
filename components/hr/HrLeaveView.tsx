import Link from "next/link";
import {
  Calendar,
  CalendarDays,
  CalendarPlus,
  History,
  Link2,
  UserCheck,
} from "lucide-react";
import { HrLeaveRecordRow } from "@/components/hr/HrLeaveRecordRow";
import { HrPendingLeaveCard } from "@/components/hr/HrPendingLeaveCard";
import {
  HrLeaveMobileSubnav,
  HrMobileSubnav,
} from "@/components/hr/layout/hr-mobile-subnav";
import {
  ModuleListPanel,
  ModuleListPanelHeader,
} from "@/components/dashboard/module-list-panel";
import type { HrLeaveRow } from "@/lib/hr/load";
import {
  leaveTypeBadgeClass,
  leaveTypeShort,
} from "@/lib/hr/leave-labels";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";
import { malaysiaTodayIso } from "@/lib/ai/malaysia-today";

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

export interface HrLeaveViewProps {
  leave: HrLeaveRow[];
}

export function HrLeaveView({ leave }: HrLeaveViewProps) {
  const today = malaysiaTodayIso();
  const monthPrefix = today.slice(0, 7);

  const pending = leave.filter((row) => row.status === "pending");
  const approvedThisMonth = leave.filter(
    (row) => row.status === "approved" && row.start_date.startsWith(monthPrefix),
  );
  const onLeaveToday = leave.filter(
    (row) =>
      row.status === "approved" &&
      row.start_date <= today &&
      row.end_date >= today,
  );
  const mcOnFile = leave.filter(
    (row) => row.leave_type === "mc" && row.mc_document_path,
  ).length;
  const recentApproved = leave.filter((row) => row.status === "approved").slice(0, 6);

  const heroHeadline =
    pending.length > 0
      ? `${pending.length} request${pending.length === 1 ? "" : "s"} need your decision`
      : onLeaveToday.length > 0
        ? `${onLeaveToday.length} away today`
        : "Leave inbox clear";

  const heroSub =
    pending.length > 0
      ? "Approve or reject below — balances update when you approve annual leave."
      : "Record leave for your team or send a request link from an employee profile.";

  return (
    <div className="space-y-6">
      <HrMobileSubnav />
      <HrLeaveMobileSubnav />

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
              HR · Leave
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
              href="/hr/leave/record"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition",
                hrClasses.btnPrimary,
              )}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Record leave
            </Link>
            <Link
              href="/hr/leave/history"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
                hrClasses.btnSecondary,
              )}
            >
              <History className="h-3.5 w-3.5" />
              Full history
            </Link>
            <Link
              href="/hr/leave/policy"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
                hrClasses.btnSecondary,
              )}
            >
              Policy
            </Link>
            <Link
              href="/hr/leave/calendar"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
                hrClasses.btnSecondary,
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </Link>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            {
              label: "Pending",
              value: pending.length,
              sub: "approvals",
              highlight: pending.length > 0,
            },
            {
              label: "Approved",
              value: approvedThisMonth.length,
              sub: "this month",
            },
            {
              label: "On leave",
              value: onLeaveToday.length,
              sub: "today",
              highlight: onLeaveToday.length > 0,
            },
            { label: "MC files", value: mcOnFile, sub: "on file" },
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

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Panel
          title="Pending approvals"
          subtitle={pending.length === 0 ? "Inbox clear" : `${pending.length} waiting`}
          action={{ href: "/hr/leave/history", label: "History" }}
        >
          {pending.length === 0 ? (
            <EmptyState icon={UserCheck} title="Nothing to approve" />
          ) : (
            <div className="space-y-2 p-2 sm:p-3">
              {pending.map((row) => (
                <HrPendingLeaveCard key={row.id} row={row} />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="On leave today"
          subtitle={onLeaveToday.length === 0 ? "Full team in" : `${onLeaveToday.length} away`}
        >
          {onLeaveToday.length === 0 ? (
            <EmptyState icon={Calendar} title="Everyone is working" />
          ) : (
            <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {onLeaveToday.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                      {row.hr_employees?.full_name ?? "Employee"}
                    </p>
                    <p className="text-xs text-ink-muted dark:text-cream-400">
                      {fmtLeaveRange(row.start_date, row.end_date)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      leaveTypeBadgeClass(row.leave_type),
                    )}
                  >
                    {leaveTypeShort(row.leave_type)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          className="md:col-span-2"
          title="Recently approved"
          subtitle={
            recentApproved.length === 0
              ? "No approved leave yet"
              : `Last ${recentApproved.length} on file`
          }
          action={{ href: "/hr/leave/history", label: "View all" }}
        >
          {recentApproved.length === 0 ? (
            <div className="px-3 py-5 text-center sm:px-4">
              <p className="text-sm text-ink-muted dark:text-cream-400">
                Record leave or share a request link from{" "}
                <Link href="/hr/employees" className={hrClasses.link}>
                  Employees
                </Link>
                .
              </p>
              <Link
                href="/hr/employees"
                className={cn("mt-3 inline-flex items-center gap-1.5 text-xs font-semibold", hrClasses.link)}
              >
                <Link2 className="h-3.5 w-3.5" />
                Send leave request link
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-cream-200 px-2 dark:divide-hairline-dark sm:px-3">
              {recentApproved.map((row) => (
                <HrLeaveRecordRow key={row.id} row={row} showStatus showManageActions />
              ))}
            </div>
          )}
        </Panel>
      </div>

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
    <ModuleListPanel as="section" className={className}>
      <ModuleListPanelHeader
        title={title}
        subtitle={subtitle}
        action={
          action ? (
            <Link href={action.href} className={cn("text-xs font-semibold", hrClasses.link)}>
              {action.label}
            </Link>
          ) : undefined
        }
      />
      {children}
    </ModuleListPanel>
  );
}

function EmptyState({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center px-3 py-5 text-center sm:px-4">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", hrClasses.iconBox)}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <p className="mt-1.5 text-sm font-medium text-ink-muted dark:text-cream-400">{title}</p>
    </div>
  );
}
