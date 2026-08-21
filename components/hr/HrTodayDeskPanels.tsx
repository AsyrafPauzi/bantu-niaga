"use client";

import Link from "next/link";
import { Calendar, FileWarning, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { HrPendingLeaveCard } from "@/components/hr/HrPendingLeaveCard";
import type { HrLeaveRow } from "@/lib/hr/load";
import {
  leaveTypeBadgeClass,
  leaveTypeShort,
} from "@/lib/hr/leave-labels";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";
import {
  computeOnboardingProgress,
} from "@/lib/hr/onboarding-progress";

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

export function HrTodayDeskPanels({
  leaveOnToday,
  leaveThisWeek,
  leavePending,
  expiringContracts,
  incompleteEmployees,
}: {
  leaveOnToday: HrLeaveRow[];
  leaveThisWeek: HrLeaveRow[];
  leavePending: HrLeaveRow[];
  expiringContracts: Array<{
    id: string;
    full_name: string;
    role_title: string;
    contract_end_date: string;
  }>;
  incompleteEmployees: Array<{
    id: string;
    full_name: string;
    percent: number;
  }>;
}) {
  const t = useTranslations("hr");
  const weekOnly = leaveThisWeek.filter(
    (row) => !leaveOnToday.some((today) => today.id === row.id),
  );

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <DeskPanel
        title={t("deskOffTitle")}
        subtitle={
          leaveOnToday.length === 0
            ? t("deskFullTeam")
            : `${leaveOnToday.length} today · ${leaveThisWeek.length} this week`
        }
        href="/hr/leave"
      >
        {leaveOnToday.length === 0 && weekOnly.length === 0 ? (
          <Empty icon={UserCheck} title={t("deskFullTeam")} />
        ) : (
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {leaveOnToday.map((row) => (
              <LeaveRow key={row.id} row={row} />
            ))}
            {weekOnly.slice(0, 4).map((row) => (
              <LeaveRow key={row.id} row={row} muted />
            ))}
          </ul>
        )}
      </DeskPanel>

      <DeskPanel
        title={t("deskPendingTitle")}
        subtitle={
          leavePending.length === 0
            ? t("deskInboxClear")
            : `${leavePending.length} waiting`
        }
        href="/hr/leave"
      >
        {leavePending.length === 0 ? (
          <Empty icon={Calendar} title={t("deskInboxClear")} />
        ) : (
          <div className="space-y-2 p-2 sm:p-3">
            {leavePending.slice(0, 3).map((row) => (
              <HrPendingLeaveCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </DeskPanel>

      <DeskPanel
        title={t("deskExpiringTitle")}
        subtitle={
          expiringContracts.length > 0
            ? `${expiringContracts.length} contracts`
            : incompleteEmployees.length > 0
              ? t("deskNeedsFile")
              : t("deskNothingExpiring")
        }
        href="/hr/employees"
      >
        {expiringContracts.length > 0 ? (
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {expiringContracts.slice(0, 5).map((emp) => (
              <li key={emp.id}>
                <Link
                  href={`/hr/employees/${emp.id}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 sm:px-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                      {emp.full_name}
                    </p>
                    <p className="text-xs text-ink-muted dark:text-cream-400">
                      {emp.role_title} · ends {fmtShortDate(emp.contract_end_date)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : incompleteEmployees.length > 0 ? (
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {incompleteEmployees.slice(0, 5).map((emp) => (
              <li key={emp.id}>
                <Link
                  href={`/hr/employees/${emp.id}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 sm:px-4"
                >
                  <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                    {emp.full_name}
                  </p>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                    {emp.percent}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={FileWarning} title={t("deskNothingExpiring")} />
        )}
      </DeskPanel>
    </div>
  );
}

function LeaveRow({ row, muted }: { row: HrLeaveRow; muted?: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 sm:px-4",
        muted && "opacity-80",
      )}
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
  );
}

function DeskPanel({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-cream-200 bg-white shadow-sm dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-start justify-between gap-2 border-b border-cream-200 px-3 py-2.5 dark:border-hairline-dark sm:px-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
            {title}
          </h2>
          <p className="text-[11px] text-ink-muted dark:text-cream-400">
            {subtitle}
          </p>
        </div>
        <Link href={href} className={cn("shrink-0 text-xs font-semibold", hrClasses.link)}>
          Open
        </Link>
      </div>
      <div className="min-h-[8rem]">{children}</div>
    </section>
  );
}

function Empty({
  icon: Icon,
  title,
}: {
  icon: typeof UserCheck;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <Icon className="h-5 w-5 text-ink-subtle dark:text-cream-500" strokeWidth={2} />
      <p className="text-sm text-ink-muted dark:text-cream-400">{title}</p>
    </div>
  );
}

/** Helper for callers computing incomplete % from onboarding flags. */
export function incompletePercentFromFlags(
  flags: ReadonlyArray<{ is_done: boolean }>,
): number {
  return computeOnboardingProgress(flags).percent;
}
