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
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function FinanceSubpageShell({
  headline,
  subcopy,
  variant = "default",
  stats,
  action,
  children,
}: FinanceSubpageShellProps) {
  return (
    <div className="space-y-4 pb-20 md:pb-8">
      <div className="flex items-center justify-between gap-3">
        <FinanceBackLink />
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
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
