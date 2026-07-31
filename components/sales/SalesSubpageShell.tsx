import { SalesBackLink } from "@/components/sales/SalesBackLink";
import {
  ModuleDashboardHero,
  type ModuleHeroVariant,
} from "@/components/dashboard/module-layout";

interface SalesSubpageShellProps {
  headline: string;
  subcopy: string;
  variant?: ModuleHeroVariant;
  stats?: React.ReactNode;
  cta?: React.ReactNode;
  children: React.ReactNode;
}

export function SalesSubpageShell({
  headline,
  subcopy,
  variant = "sales",
  stats,
  cta,
  children,
}: SalesSubpageShellProps) {
  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <SalesBackLink />
      <ModuleDashboardHero
        module="Sales"
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
