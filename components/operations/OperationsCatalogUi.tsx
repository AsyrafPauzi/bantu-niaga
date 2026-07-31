import { cn } from "@/lib/utils/cn";

export function OperationsCatalogList({
  title,
  total,
  children,
  className,
}: {
  title: string;
  total?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-cream-200 bg-white dark:border-hairline-dark dark:bg-panel-dark",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-cream-200 px-3 py-2 dark:border-hairline-dark">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
          {title}
        </p>
        {total != null ? (
          <span className="text-[11px] tabular-nums text-ink-muted dark:text-cream-400">
            {total} total
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function OperationsCatalogEmpty({
  icon,
  title,
  hint,
  action,
}: {
  icon: string;
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-cream-300 bg-cream-50/50 py-14 text-center dark:border-hairline-dark dark:bg-panel-dark/30">
      <p className="text-4xl" aria-hidden>
        {icon}
      </p>
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
        : "border-brand-200 from-brand-50/80 to-emerald-50/50 dark:border-brand-900/40 dark:from-brand-950/20 dark:to-emerald-950/10";

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
  emoji,
  className,
}: {
  emoji: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-cream-200 bg-gradient-to-br from-emerald-50/90 to-sky-50/80 text-2xl dark:border-hairline-dark dark:from-emerald-950/40 dark:to-sky-950/30",
        className,
      )}
      aria-hidden
    >
      {emoji}
    </div>
  );
}
