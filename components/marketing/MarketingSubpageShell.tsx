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
  cta?: React.ReactNode;
  children: React.ReactNode;
}

export function MarketingSubpageShell({
  headline,
  subcopy,
  variant = "default",
  stats,
  cta,
  children,
}: MarketingSubpageShellProps) {
  return (
    <div className="space-y-4 pb-20 md:pb-8">
      <MarketingBackLink />
      <ModuleDashboardHero
        module="Marketing"
        pillar="marketing"
        headline={headline}
        subcopy={subcopy}
        variant={variant}
        cta={cta}
      >
        {stats}
      </ModuleDashboardHero>
      {children}
    </div>
  );
}
