import { MarketingBackLink } from "@/components/marketing/MarketingBackLink";
import {
  ModuleDashboardHero,
  type LegacyModuleHeroVariant,
} from "@/components/dashboard/module-layout";

interface MarketingSubpageShellProps {
  headline: string;
  subcopy: string;
  variant?: LegacyModuleHeroVariant;
  stats?: React.ReactNode;
  /** Top-right actions (next to back link), outside the hero card. */
  action?: React.ReactNode;
  /** @deprecated Prefer `action` — kept as alias for older call sites. */
  cta?: React.ReactNode;
  children: React.ReactNode;
}

export function MarketingSubpageShell({
  headline,
  subcopy,
  variant = "default",
  stats,
  action,
  cta,
  children,
}: MarketingSubpageShellProps) {
  const topAction = action ?? cta;

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      <div className="flex items-center justify-between gap-3">
        <MarketingBackLink />
        {topAction ? <div className="shrink-0">{topAction}</div> : null}
      </div>
      <ModuleDashboardHero
        module="Marketing"
        pillar="marketing"
        headline={headline}
        subcopy={subcopy}
        variant={variant}
      >
        {stats}
      </ModuleDashboardHero>
      {children}
    </div>
  );
}
