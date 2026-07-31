import { FinanceBackLink } from "@/components/finance/FinanceBackLink";
import {
  ModuleDashboardHero,
  type ModuleHeroVariant,
} from "@/components/dashboard/module-layout";

interface FinanceSubpageShellProps {
  headline: string;
  subcopy: string;
  variant?: ModuleHeroVariant;
  stats: React.ReactNode;
  children: React.ReactNode;
}

export function FinanceSubpageShell({
  headline,
  subcopy,
  variant = "calm",
  stats,
  children,
}: FinanceSubpageShellProps) {
  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <FinanceBackLink />
      <ModuleDashboardHero
        module="Finance"
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
