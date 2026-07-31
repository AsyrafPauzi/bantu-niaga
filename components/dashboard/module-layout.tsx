import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function ModuleDashboardShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-6 pb-8", className)}>{children}</div>;
}

export type ModuleHeroVariant = "calm" | "attention" | "finance-up" | "finance-down";

const HERO_VARIANT_CLASS: Record<ModuleHeroVariant, string> = {
  calm: "border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-teal-50 dark:border-sky-900/40 dark:from-sky-950/30 dark:via-panel-dark dark:to-teal-950/20",
  attention:
    "border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-panel-dark dark:to-orange-950/20",
  "finance-up":
    "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-brand-50 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-panel-dark dark:to-brand-950/20",
  "finance-down":
    "border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-amber-50 dark:border-rose-900/40 dark:from-rose-950/30 dark:via-panel-dark dark:to-amber-950/20",
};

const MODULE_EYEBROW_CLASS: Record<string, string> = {
  Operations: "text-sky-700 dark:text-sky-300",
  Admin: "text-violet-700 dark:text-violet-300",
  Finance: "text-emerald-700 dark:text-emerald-300",
};

interface ModuleDashboardHeroProps {
  module: string;
  headline: string;
  subcopy: string;
  variant?: ModuleHeroVariant;
  emoji?: string;
  cta?: React.ReactNode;
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
}

export function ModuleDashboardHero({
  module,
  headline,
  subcopy,
  variant = "calm",
  emoji,
  cta,
  headerExtra,
  children,
}: ModuleDashboardHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 shadow-card sm:p-6",
        HERO_VARIANT_CLASS[variant],
      )}
    >
      {emoji ? (
        <div className="pointer-events-none absolute -right-2 -top-2 text-7xl opacity-15">
          {emoji}
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {headerExtra}
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              MODULE_EYEBROW_CLASS[module] ?? "text-brand-700 dark:text-brand-200",
            )}
          >
            {module}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-3xl">
            {headline}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted dark:text-cream-300">
            {subcopy}
          </p>
        </div>
        {cta}
      </div>
      {children}
    </section>
  );
}

interface ModuleHeroStatProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  href?: string;
}

export function ModuleHeroStat({
  label,
  value,
  hint,
  icon: Icon,
  iconClassName,
  href,
}: ModuleHeroStatProps) {
  const inner = (
    <>
      <p
        className={cn(
          "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
          iconClassName ?? "text-ink-muted dark:text-cream-400",
        )}
      >
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums text-ink dark:text-cream-100">
        {value}
      </p>
      {hint ? (
        <p className="text-[10px] text-ink-muted dark:text-cream-500">{hint}</p>
      ) : null}
    </>
  );

  const className =
    "rounded-xl border border-white/60 bg-white/70 p-3 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(className, "transition-colors hover:border-brand-200 dark:hover:border-brand-700")}
      >
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

export type ModuleAttentionTone = "danger" | "warning" | "neutral";

export function ModuleAttentionPills({
  items,
}: {
  items: Array<{ label: string; href: string; tone: ModuleAttentionTone }>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            item.tone === "danger" &&
              "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100",
            item.tone === "warning" &&
              "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
            item.tone === "neutral" &&
              "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {item.label}
        </Link>
      ))}
    </div>
  );
}

interface ModulePanelProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ModulePanel({
  title,
  subtitle,
  action,
  children,
  className,
}: ModulePanelProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3 dark:border-hairline-dark sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-xs text-ink-muted dark:text-cream-400">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export interface ModuleQuickAction {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accent: string;
}

export function ModuleQuickActions({
  module,
  actions,
  footer,
}: {
  module: string;
  actions: readonly ModuleQuickAction[];
  footer?: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-300" />
        <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
          Everything in {module}
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.href + action.title}
            href={action.href}
            className="group relative overflow-hidden rounded-2xl border border-cream-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-brand-800"
          >
            <div
              className={cn(
                "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                action.accent,
              )}
            >
              <action.icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              {action.title}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              {action.subtitle}
            </p>
          </Link>
        ))}
        {footer}
      </div>
    </section>
  );
}
