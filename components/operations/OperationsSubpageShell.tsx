import { OperationsBackLink } from "@/components/operations/OperationsBackLink";
import {
  ModuleDashboardHero,
  type LegacyModuleHeroVariant,
} from "@/components/dashboard/module-layout";

interface OperationsSubpageShellProps {
  headline: string;
  subcopy: string;
  variant?: LegacyModuleHeroVariant;
  stats: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function OperationsSubpageShell({
  headline,
  subcopy,
  variant = "default",
  stats,
  action,
  children,
}: OperationsSubpageShellProps) {
  return (
    <div className="space-y-4 pb-20 md:pb-8">
      <div className="flex items-center justify-between gap-3">
        <OperationsBackLink />
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <ModuleDashboardHero
        module="Operations"
        pillar="operations"
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
