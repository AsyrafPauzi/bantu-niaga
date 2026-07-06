import Link from "next/link";
import { ChevronRight, Link2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type EmployeeStatus = "active" | "inactive" | "terminated" | "on_leave" | string;

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active: {
    bg: "bg-[#E6F3EC]",
    text: "text-[#0F7B4A]",
    dot: "bg-[#0F7B4A]",
    label: "Active",
  },
  on_leave: {
    bg: "bg-[#FBF1DC]",
    text: "text-[#D89614]",
    dot: "bg-[#D89614]",
    label: "On leave",
  },
  inactive: {
    bg: "bg-cream-100",
    text: "text-ink-muted",
    dot: "bg-ink-subtle",
    label: "Inactive",
  },
};

interface HrPersonListRowProps {
  id: string;
  name: string;
  roleLine: string;
  status?: EmployeeStatus;
  className?: string;
}

export function HrPersonListRow({
  id,
  name,
  roleLine,
  status = "active",
  className,
}: HrPersonListRowProps) {
  const initials = name.slice(0, 2).toUpperCase();
  const statusKey =
    status === "on_leave"
      ? "on_leave"
      : status === "inactive" || status === "terminated"
        ? "inactive"
        : "active";
  const chip = STATUS_STYLES[statusKey] ?? STATUS_STYLES.active;
  const displayLabel =
    status === "on_leave"
      ? "On leave"
      : status === "terminated"
        ? "Terminated"
        : status === "inactive"
          ? "Inactive"
          : "Active";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-[#E5E0D8] bg-white px-4 py-3 dark:border-hairline-dark dark:bg-panel-dark",
        className,
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">{name}</p>
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
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href={`/hr/employees/${id}/share-leave`}
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-cream-100 hover:text-brand-700 dark:text-cream-400 dark:hover:bg-hairline-dark dark:hover:text-brand-200"
          aria-label={`Share leave form for ${name}`}
        >
          <Link2 className="h-4 w-4" strokeWidth={2} />
        </Link>
        <Link
          href={`/hr/employees/${id}`}
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-cream-100 hover:text-brand-700 dark:text-cream-400 dark:hover:bg-hairline-dark dark:hover:text-brand-200"
          aria-label={`Edit ${name}`}
        >
          <Pencil className="h-4 w-4" strokeWidth={2} />
        </Link>
        <Link
          href={`/hr/employees/${id}`}
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-cream-100 hover:text-brand-700 dark:text-cream-400 dark:hover:bg-hairline-dark dark:hover:text-brand-200"
          aria-label={`View ${name}`}
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
