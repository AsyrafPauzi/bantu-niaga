import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { ModuleNavLabel } from "@/components/dashboard/ModuleNavLabel";
import type { Pillar } from "@/lib/permissions";
import {
  getPillarClasses,
  pillarFromModule,
  type PillarClasses,
} from "@/lib/pillars/theme";
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

export type ModuleHeroVariant =
  | "default"
  | "attention"
  | "finance-up"
  | "finance-down";

/** Legacy variants map to pillar default or semantic states. */
export type LegacyModuleHeroVariant =
  | "calm"
  | "marketing"
  | "sales"
  | ModuleHeroVariant;

function normalizeVariant(
  variant: LegacyModuleHeroVariant | undefined,
): ModuleHeroVariant {
  if (!variant || variant === "calm" || variant === "marketing" || variant === "sales") {
    return "default";
  }
  return variant;
}

function heroClassFor(
  _pillar: Pillar,
  _variant: ModuleHeroVariant,
  classes: PillarClasses,
): string {
  return cn(classes.heroBorder, classes.heroBg);
}

interface ModuleDashboardHeroProps {
  module: string;
  headline: string;
  subcopy: string;
  pillar?: Pillar;
  variant?: LegacyModuleHeroVariant;
  emoji?: string;
  cta?: React.ReactNode;
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
}

export function ModuleDashboardHero({
  module,
  headline,
  subcopy,
  pillar: pillarProp,
  variant = "default",
  emoji,
  cta,
  headerExtra,
  children,
}: ModuleDashboardHeroProps) {
  const pillar = pillarProp ?? pillarFromModule(module);
  const classes = getPillarClasses(pillar);
  const resolvedVariant = normalizeVariant(variant);

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 shadow-sm sm:p-5",
        heroClassFor(pillar, resolvedVariant, classes),
      )}
    >
      {emoji ? (
        <div className="pointer-events-none absolute -right-2 -top-2 text-7xl opacity-15">
          {emoji}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {headerExtra}
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-widest",
              classes.eyebrow,
            )}
          >
            <ModuleNavLabel module={module} />
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
            {headline}
          </h1>
          <p className="mt-0.5 max-w-xl text-sm text-ink-muted dark:text-cream-400">
            {subcopy}
          </p>
        </div>
        {cta ? <div className="shrink-0">{cta}</div> : null}
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
  pillar?: Pillar;
}

export function ModuleHeroStat({
  label,
  value,
  hint,
  icon: Icon,
  iconClassName,
  href,
  pillar,
}: ModuleHeroStatProps) {
  const classes = pillar ? getPillarClasses(pillar) : null;
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

  const hoverClass =
    classes?.quickActionHover ??
    "hover:border-brand-200 dark:hover:border-brand-700";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(className, "transition-colors", hoverClass)}
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
        "rounded-xl border border-cream-200 bg-white shadow-sm dark:border-hairline-dark dark:bg-panel-dark",
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
  accent?: string;
}

export function ModuleQuickActions({
  module,
  actions,
  footer,
  pillar: pillarProp,
}: {
  module: string;
  actions: readonly ModuleQuickAction[];
  footer?: React.ReactNode;
  pillar?: Pillar;
}) {
  const pillar = pillarProp ?? pillarFromModule(module);
  const classes = getPillarClasses(pillar);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className={cn("h-4 w-4", classes.text)} />
        <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
          Everything in {module}
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.href + action.title}
            href={action.href}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-cream-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-hairline-dark dark:bg-panel-dark",
              classes.quickActionHover,
            )}
          >
            <div
              className={cn(
                "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                action.accent ?? classes.accentGradient,
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
