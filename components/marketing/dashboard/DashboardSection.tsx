import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface DashboardSectionProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Optional extra class on the outer wrapper. */
  className?: string;
  /**
   * If true, paint a subtle 4px brand-500 left bar on the heading row.
   * Used on hero sections of the dashboard to keep the brand colour
   * present even on text-heavy cards.
   */
  accent?: boolean;
}

export function DashboardSection({
  title,
  subtitle,
  action,
  children,
  className,
  accent,
}: DashboardSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || action) && (
        <header className="flex items-end justify-between gap-3">
          <div
            className={cn(
              "min-w-0",
              accent &&
                "border-l-4 border-brand-500 pl-3 dark:border-brand-400",
            )}
          >
            {title ? (
              <h2 className="text-lg font-semibold text-ink dark:text-cream-100">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                {subtitle}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}
