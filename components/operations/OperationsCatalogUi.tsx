import { cn } from "@/lib/utils/cn";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
  ModuleListPanelHeader,
  ModuleListPanelFooter,
} from "@/components/dashboard/module-list-panel";

export function OperationsCatalogList({
  title,
  total,
  children,
  className,
  filters,
  footer,
}: {
  title: string;
  total?: number;
  children: React.ReactNode;
  className?: string;
  /** Renders inside ModuleListPanelFilters (search, chips). */
  filters?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <ModuleListPanel className={className}>
      {filters ? (
        <ModuleListPanelFilters>
          {filters}
          {total != null ? (
            <p className="mt-3 text-xs font-medium text-ink-muted dark:text-cream-400">
              {title} · {total} total
            </p>
          ) : null}
        </ModuleListPanelFilters>
      ) : (
        <ModuleListPanelHeader
          variant="compact"
          title={title}
          subtitle={total != null ? `${total} total` : undefined}
        />
      )}
      {children}
      {footer}
    </ModuleListPanel>
  );
}

export function OperationsCatalogEmpty({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-cream-300 bg-cream-50/50 py-14 text-center dark:border-hairline-dark dark:bg-panel-dark/30">
      <span
        className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cream-200 bg-cream-50 text-ink-muted dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
        aria-hidden
      >
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-ink dark:text-cream-100">
        {title}
      </p>
      <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">{hint}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function OperationsCatalogEditShell({
  title,
  children,
  accent = "brand",
}: {
  title: string;
  children: React.ReactNode;
  accent?: "brand" | "violet" | "emerald";
}) {
  const accentClass =
    accent === "violet"
      ? "border-violet-200 from-violet-50/80 to-purple-50/50 dark:border-violet-900/40 dark:from-violet-950/20 dark:to-purple-950/10"
      : accent === "emerald"
        ? "border-emerald-200 from-emerald-50/80 to-teal-50/50 dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-teal-950/10"
        : "border-brand-200 from-brand-50/80 to-emerald-50/50 dark:border-brand-900/40 dark:from-brand-700/10 dark:to-emerald-950/10";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br via-white p-4 shadow-card dark:via-panel-dark sm:p-5",
        accentClass,
      )}
    >
      <p className="text-sm font-semibold text-ink dark:text-cream-100">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function OperationsCatalogThumb({
  icon,
  className,
}: {
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-cream-200 bg-gradient-to-br from-emerald-50/90 to-sky-50/80 text-ink-muted dark:border-hairline-dark dark:from-emerald-950/40 dark:to-sky-950/30 dark:text-cream-400",
        className,
      )}
      aria-hidden
    >
      {icon}
    </div>
  );
}
