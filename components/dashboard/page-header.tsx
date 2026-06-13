import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Standard dashboard header row used at the top of every pillar overview.
 * Mirrors the "Topbar" frame in the Pencil designs.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl dark:text-cream-100">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-base text-ink-muted dark:text-cream-400">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}
