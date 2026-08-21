import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
  ModuleListPanelHeader,
} from "@/components/dashboard/module-list-panel";

export function AdminCatalogThumb({
  icon: Icon,
  className,
  tone = "violet",
}: {
  icon: LucideIcon;
  className?: string;
  tone?: "violet" | "amber" | "sky" | "emerald" | "rose";
}) {
  const toneClass =
    tone === "amber"
      ? "from-amber-50/90 to-orange-50/80 dark:from-amber-950/40 dark:to-orange-950/30"
      : tone === "sky"
        ? "from-sky-50/90 to-blue-50/80 dark:from-sky-950/40 dark:to-blue-950/30"
        : tone === "emerald"
          ? "from-emerald-50/90 to-teal-50/80 dark:from-emerald-950/40 dark:to-teal-950/30"
          : tone === "rose"
            ? "from-rose-50/90 to-pink-50/80 dark:from-rose-950/40 dark:to-pink-950/30"
            : "from-violet-50/90 to-purple-50/80 dark:from-violet-950/40 dark:to-purple-950/30";

  const iconClass =
    tone === "amber"
      ? "text-amber-700 dark:text-amber-300"
      : tone === "sky"
        ? "text-sky-700 dark:text-sky-300"
        : tone === "emerald"
          ? "text-emerald-700 dark:text-emerald-300"
          : tone === "rose"
            ? "text-rose-700 dark:text-rose-300"
            : "text-violet-700 dark:text-violet-300";

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cream-200 bg-gradient-to-br dark:border-hairline-dark",
        toneClass,
        className,
      )}
      aria-hidden
    >
      <Icon className={cn("h-4 w-4", iconClass)} strokeWidth={2} />
    </div>
  );
}

export function AdminCatalogList({
  title,
  total,
  children,
  className,
  filters,
}: {
  title: string;
  total?: number;
  children: React.ReactNode;
  className?: string;
  /** Renders inside ModuleListPanelFilters (search, chips, view toggles). */
  filters?: React.ReactNode;
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
    </ModuleListPanel>
  );
}

export function AdminCatalogEmpty({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-violet-200/80 bg-violet-50/30 py-14 text-center dark:border-violet-900/40 dark:bg-violet-950/15",
        className,
      )}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-violet-200/80 bg-white shadow-sm dark:border-violet-800 dark:bg-panel-dark">
        <span className="inline-flex text-violet-700 [&>svg]:h-5 [&>svg]:w-5 dark:text-violet-300">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-ink dark:text-cream-100">
        {title}
      </p>
      <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">{hint}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function AdminCatalogEditShell({
  title,
  children,
  accent = "violet",
}: {
  title: string;
  children: React.ReactNode;
  accent?: "violet" | "brand" | "amber";
}) {
  const accentClass =
    accent === "amber"
      ? "border-amber-200 from-amber-50/80 to-orange-50/50 dark:border-amber-900/40 dark:from-amber-950/20 dark:to-orange-950/10"
      : accent === "brand"
        ? "border-brand-200 from-brand-50/80 to-emerald-50/50 dark:border-brand-900/40 dark:from-brand-700/10 dark:to-emerald-950/10"
        : "border-violet-200 from-violet-50/80 to-purple-50/50 dark:border-violet-900/40 dark:from-violet-950/20 dark:to-purple-950/10";

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
