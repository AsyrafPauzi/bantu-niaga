import { MarketingBackLink } from "@/components/marketing/MarketingBackLink";
import {
  ModuleDashboardHero,
  type ModuleHeroVariant,
} from "@/components/dashboard/module-layout";

interface MarketingSubpageShellProps {
  headline: string;
  subcopy: string;
  variant?: ModuleHeroVariant;
  stats?: React.ReactNode;
  cta?: React.ReactNode;
  children: React.ReactNode;
}

export function MarketingSubpageShell({
  headline,
  subcopy,
  variant = "calm",
  stats,
  cta,
  children,
}: MarketingSubpageShellProps) {
  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <MarketingBackLink />
      <ModuleDashboardHero
        module="Marketing"
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
