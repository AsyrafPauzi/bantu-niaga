import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HrLeaveCreateForm } from "@/components/hr/HrLeaveCreateForm";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import type { HrEmployeeRow } from "@/lib/hr/load";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

export interface HrLeaveRecordViewProps {
  employees: HrEmployeeRow[];
  defaultEmployeeId?: string;
}

export function HrLeaveRecordView({
  employees,
  defaultEmployeeId,
}: HrLeaveRecordViewProps) {
  const selected = defaultEmployeeId
    ? employees.find((e) => e.id === defaultEmployeeId)
    : undefined;
  const activeCount = employees.filter((e) => e.status === "active").length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-10 lg:py-6">
      <HrMobileSubnav />

      <Link
        href="/hr/leave"
        className={cn("inline-flex items-center gap-1.5 text-sm", hrClasses.link)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to leave
      </Link>

      <section
        className={cn(
          "relative mt-3 overflow-hidden rounded-xl border p-4 shadow-sm sm:p-5",
          hrClasses.heroBorder,
          hrClasses.heroBg,
        )}
      >
        <p className={cn("text-[11px] font-semibold uppercase tracking-widest", hrClasses.textMuted)}>
          HR · Record leave
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
          {selected ? `Leave for ${selected.full_name}` : "Log time off"}
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
          {selected
            ? `${selected.role_title} · appears on Leave for approval`
            : `${activeCount} active staff · choose employee below`}
        </p>
      </section>

      <div className="mt-3 rounded-xl border border-cream-200 bg-white p-4 sm:p-5 dark:border-hairline-dark dark:bg-panel-dark">
        <HrLeaveCreateForm
          employees={employees}
          redirectTo="/hr/leave"
          defaultEmployeeId={defaultEmployeeId}
        />
      </div>

      <div className="pb-16 lg:pb-6" />
    </div>
  );
}
