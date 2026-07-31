import { OperationsBackLink } from "@/components/operations/OperationsBackLink";
import {
  ModuleDashboardHero,
  type ModuleHeroVariant,
} from "@/components/dashboard/module-layout";

interface OperationsSubpageShellProps {
  headline: string;
  subcopy: string;
  variant?: ModuleHeroVariant;
  stats: React.ReactNode;
  children: React.ReactNode;
}

export function OperationsSubpageShell({
  headline,
  subcopy,
  variant = "calm",
  stats,
  children,
}: OperationsSubpageShellProps) {
  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <OperationsBackLink />
      <ModuleDashboardHero
        module="Operations"
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
