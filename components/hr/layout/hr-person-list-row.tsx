import Link from "next/link";
import { AlertCircle, ChevronRight, Link2, Pencil } from "lucide-react";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

type EmployeeStatus = "active" | "inactive" | "terminated" | "on_leave" | string;

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  active: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-[#0F766E] dark:text-teal-300",
    dot: "bg-[#0D9488]",
  },
  on_leave: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-800 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  inactive: {
    bg: "bg-cream-100 dark:bg-hairline-dark",
    text: "text-ink-muted dark:text-cream-400",
    dot: "bg-ink-subtle",
  },
};

interface HrPersonListRowProps {
  id: string;
  name: string;
  roleLine: string;
  status?: EmployeeStatus;
  incomplete?: boolean;
  className?: string;
}

export function HrPersonListRow({
  id,
  name,
  roleLine,
  status = "active",
  incomplete = false,
  className,
}: HrPersonListRowProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const statusKey =
    status === "on_leave"
      ? "on_leave"
      : status === "inactive" || status === "terminated"
        ? "inactive"
        : "active";
  const chip = STATUS_STYLES[statusKey] ?? STATUS_STYLES.active;
  const displayLabel =
    status === "terminated"
      ? "Terminated"
      : status === "inactive"
        ? "Inactive"
        : status === "on_leave"
          ? "On leave"
          : "Active";

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-cream-200 bg-white px-4 py-3 transition hover:border-teal-200 hover:shadow-sm dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-teal-900",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase",
          hrClasses.avatar,
        )}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
            {name}
          </p>
          {incomplete ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertCircle className="h-3 w-3" />
              Setup pending
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-ink-muted dark:text-cream-400">{roleLine}</p>
      </div>
      <span
        className={cn(
          "hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex",
          chip.bg,
          chip.text,
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", chip.dot)} />
        {displayLabel}
      </span>
      <div className="flex shrink-0 items-center gap-0.5 opacity-80 transition group-hover:opacity-100">
        <Link
          href={`/hr/employees/${id}?tab=leave&leave_link=1`}
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-teal-50 hover:text-[#0D9488] dark:text-cream-400 dark:hover:bg-teal-950/40 dark:hover:text-teal-300"
          aria-label={`Send leave request link for ${name}`}
        >
          <Link2 className="h-4 w-4" strokeWidth={2} />
        </Link>
        <Link
          href={`/hr/employees/${id}`}
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-teal-50 hover:text-[#0D9488] dark:text-cream-400 dark:hover:bg-teal-950/40 dark:hover:text-teal-300"
          aria-label={`Edit ${name}`}
        >
          <Pencil className="h-4 w-4" strokeWidth={2} />
        </Link>
        <Link
          href={`/hr/employees/${id}`}
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-teal-50 hover:text-[#0D9488] dark:text-cream-400 dark:hover:bg-teal-950/40 dark:hover:text-teal-300"
          aria-label={`View ${name}`}
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
