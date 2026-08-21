import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

/* ─── EmptyState ─────────────────────────────────────────────── */

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** "page" = centred in full available height; "section" = inline, smaller */
  variant?: "page" | "section" | "compact";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "section",
  className,
}: EmptyStateProps) {
  const variantClass: Record<typeof variant, string> = {
    page: "py-24",
    section: "py-16",
    compact: "py-8",
  };

  const iconSize: Record<typeof variant, string> = {
    page: "w-16 h-16",
    section: "w-12 h-12",
    compact: "w-10 h-10",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6",
        variantClass[variant],
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex items-center justify-center mb-4 rounded-2xl",
            "bg-cream-100 dark:bg-hairline-dark",
            "text-ink-muted dark:text-cream-400",
            iconSize[variant],
          )}
        >
          {icon}
        </div>
      )}
      <h3
        className={cn(
          "font-semibold text-ink dark:text-cream-100",
          variant === "compact" ? "text-sm" : "text-base",
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "mt-1.5 text-ink-muted dark:text-cream-400 max-w-sm leading-relaxed",
            variant === "compact" ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ─── ErrorState ─────────────────────────────────────────────── */

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-16",
        className,
      )}
    >
      <div className="flex items-center justify-center w-14 h-14 mb-4 rounded-2xl bg-[#F8DDD9] dark:bg-[#3A1714]">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-status-danger"
        >
          <path
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-ink dark:text-cream-100">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-muted dark:text-cream-400 max-w-sm">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 h-9 px-4 rounded-lg text-sm font-medium bg-cream-200 text-ink hover:bg-cream-300 dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark dark:border dark:border-hairline-dark transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
