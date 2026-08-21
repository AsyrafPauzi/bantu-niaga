import { SalesBackLink } from "@/components/sales/SalesBackLink";
import {
  ModuleDashboardHero,
  type LegacyModuleHeroVariant,
} from "@/components/dashboard/module-layout";

interface SalesSubpageShellProps {
  headline: string;
  subcopy: string;
  variant?: LegacyModuleHeroVariant;
  stats?: React.ReactNode;
  cta?: React.ReactNode;
  children: React.ReactNode;
}

export function SalesSubpageShell({
  headline,
  subcopy,
  variant = "default",
  stats,
  cta,
  children,
}: SalesSubpageShellProps) {
  return (
    <div className="space-y-4 pb-20 md:pb-8">
      <SalesBackLink />
      <ModuleDashboardHero
        module="Sales"
        pillar="sales"
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
