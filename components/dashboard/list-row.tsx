import { cn } from "@/lib/utils/cn";

interface ListRowProps {
  initials: string;
  title: string;
  subtitle: string;
  value: string;
  className?: string;
}

/**
 * Initials avatar + 2-line text + right-aligned value row.
 *
 * Used for "Top customers", "Top SKUs", and "Upcoming this week" lists on the
 * pillar dashboards.
 */
export function ListRow({
  initials,
  title,
  subtitle,
  value,
  className,
}: ListRowProps) {
  return (
    <div className={cn("flex items-center gap-3 py-2.5", className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
          {title}
        </p>
        <p className="truncate text-xs text-ink-muted dark:text-cream-400">
          {subtitle}
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-ink dark:text-cream-100">
        {value}
      </p>
    </div>
  );
}
