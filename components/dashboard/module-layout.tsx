import Link from "next/link";
import { ModuleNavLabel } from "@/components/dashboard/ModuleNavLabel";
import type { Pillar } from "@/lib/permissions";
import {
  getPillarClasses,
  pillarFromModule,
  type PillarClasses,
} from "@/lib/pillars/theme";
import { cn } from "@/lib/utils/cn";

export {
  ModuleDashboardShell,
  ModuleHeroStat,
  ModuleAttentionPills,
  ModulePanel,
  ModuleQuickActions,
} from "./module-primitives";
export type { ModuleQuickAction, ModuleAttentionTone } from "./module-primitives";

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
