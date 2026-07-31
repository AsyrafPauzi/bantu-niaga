import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface AdminOverviewPanelProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AdminOverviewPanel({
  title,
  subtitle,
  action,
  children,
  className,
}: AdminOverviewPanelProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-cream-200 px-4 py-3 dark:border-hairline-dark sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-xs text-ink-muted dark:text-cream-400">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

interface AdminOverviewRowProps {
  href: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  trailing?: React.ReactNode;
  overdue?: boolean;
}

export function AdminOverviewRow({
  href,
  title,
  subtitle,
  badge,
  trailing,
  overdue,
}: AdminOverviewRowProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-cream-50 dark:hover:bg-panel-dark/60 sm:px-5",
        overdue && "bg-rose-50/30 dark:bg-rose-950/10",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
          {title}
        </p>
        {subtitle ? (
          <p
            className={cn(
              "truncate text-xs text-ink-muted dark:text-cream-400",
              overdue && "font-medium text-rose-700 dark:text-rose-200",
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {badge}
        {trailing}
      </div>
    </Link>
  );
}
