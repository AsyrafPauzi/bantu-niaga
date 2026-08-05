import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Canonical list / table card shell — shared across all pillars. */
export const MODULE_LIST_PANEL_CLASS =
  "overflow-hidden rounded-xl border border-hairline-light bg-panel-light shadow-card dark:border-hairline-dark dark:bg-panel-dark";

export const MODULE_LIST_TABLE_HEAD_CLASS =
  "bg-cream-100/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400";

export const MODULE_LIST_TABLE_BODY_CLASS =
  "divide-y divide-cream-200 dark:divide-hairline-dark";

export const MODULE_LIST_TABLE_ROW_CLASS =
  "bg-panel-light hover:bg-cream-100/60 dark:bg-panel-dark dark:hover:bg-hairline-dark/40";

export const MODULE_LIST_ROWS_CLASS =
  "divide-y divide-cream-100 dark:divide-hairline-dark";

export const MODULE_LIST_FOOTER_CLASS =
  "flex items-center justify-between border-t border-cream-200 bg-cream-100/40 px-5 py-3 text-xs text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400";

type PanelElement = "div" | "section";

export function ModuleListPanel({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: PanelElement;
}) {
  return <Tag className={cn(MODULE_LIST_PANEL_CLASS, className)}>{children}</Tag>;
}

export function ModuleListPanelHeader({
  title,
  subtitle,
  action,
  variant = "default",
  className,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  variant?: "default" | "compact";
  className?: string;
  children?: ReactNode;
}) {
  if (children) {
    return (
      <div
        className={cn(
          "border-b border-cream-200 dark:border-hairline-dark",
          variant === "compact" ? "px-3 py-2" : "px-4 py-3 sm:px-5",
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-cream-200 dark:border-hairline-dark",
        variant === "compact" ? "px-3 py-2" : "px-4 py-3 sm:px-5",
        className,
      )}
    >
      <div className="min-w-0">
        {variant === "compact" ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
            {title}
          </p>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {subtitle}
              </p>
            ) : null}
          </>
        )}
      </div>
      {variant === "compact" && subtitle ? (
        <span className="text-[11px] tabular-nums text-ink-muted dark:text-cream-400">
          {subtitle}
        </span>
      ) : (
        action
      )}
    </div>
  );
}

export function ModuleListPanelFilters({
  children,
  className,
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-b border-cream-200 p-4 dark:border-hairline-dark sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ModuleListPanelFooter({
  children,
  className,
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(MODULE_LIST_FOOTER_CLASS, className)}>{children}</div>
  );
}

export function ModuleListTable({
  children,
  className,
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn("min-w-full text-sm", className)}>{children}</table>
  );
}

export function ModuleListTableHead({
  children,
  className,
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn(MODULE_LIST_TABLE_HEAD_CLASS, className)}>
      {children}
    </thead>
  );
}

export function ModuleListTableBody({
  children,
  className,
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn(MODULE_LIST_TABLE_BODY_CLASS, className)}>
      {children}
    </tbody>
  );
}

export function ModuleListRows({
  children,
  className,
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(MODULE_LIST_ROWS_CLASS, className)}>{children}</div>
  );
}

export function ModuleListRow({
  href,
  title,
  subtitle,
  badge,
  trailing,
  overdue,
  className,
}: {
  href: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  trailing?: ReactNode;
  overdue?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-cream-50 dark:hover:bg-panel-dark/60 sm:px-5",
        overdue && "bg-rose-50/30 dark:bg-rose-950/10",
        className,
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
