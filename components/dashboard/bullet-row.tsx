import { cn } from "@/lib/utils/cn";

type BarTone = "brand" | "accent" | "success" | "warning" | "danger" | "muted";

const BAR_TONE: Record<BarTone, string> = {
  brand: "bg-brand-500",
  accent: "bg-accent-500",
  success: "bg-status-success",
  warning: "bg-status-warning",
  danger: "bg-status-danger",
  muted: "bg-ink-subtle",
};

interface BulletRowProps {
  label: string;
  sublabel?: string;
  value: string;
  /** 0–100 fill percentage of the inline progress bar. */
  fill?: number;
  tone?: BarTone;
  className?: string;
}

/**
 * Compact label + inline progress bar + value row.
 *
 * Used by:
 *   - Admin   → "Documents by category"
 *   - Finance → "AR aging buckets"
 *   - Ops     → "Order pipeline"
 *   - Sales   → "Top SKUs (MTD)"
 *   - HR      → "Headcount by department"
 */
export function BulletRow({
  label,
  sublabel,
  value,
  fill = 0,
  tone = "brand",
  className,
}: BulletRowProps) {
  const clamped = Math.max(0, Math.min(100, fill));

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
            {label}
          </p>
          {sublabel ? (
            <p className="text-xs text-ink-muted dark:text-cream-400">{sublabel}</p>
          ) : null}
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-ink dark:text-cream-100">
          {value}
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-200 dark:bg-hairline-dark">
        <div
          className={cn("h-full rounded-full", BAR_TONE[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
