import { FinanceBackLink } from "@/components/finance/FinanceBackLink";
import {
  ModuleDashboardHero,
  type LegacyModuleHeroVariant,
} from "@/components/dashboard/module-layout";

interface FinanceSubpageShellProps {
  headline: string;
  subcopy: string;
  variant?: LegacyModuleHeroVariant;
  stats: React.ReactNode;
  children: React.ReactNode;
}

export function FinanceSubpageShell({
  headline,
  subcopy,
  variant = "default",
  stats,
  children,
}: FinanceSubpageShellProps) {
  return (
    <div className="space-y-4 pb-20 md:pb-8">
      <FinanceBackLink />
      <ModuleDashboardHero
        module="Finance"
        pillar="finance"
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
