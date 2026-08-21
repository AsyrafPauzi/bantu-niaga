import { AdminBackLink } from "@/components/admin/AdminBackLink";
import {
  ModuleDashboardHero,
  type LegacyModuleHeroVariant,
} from "@/components/dashboard/module-layout";

interface AdminSubpageShellProps {
  headline: string;
  subcopy: string;
  variant?: LegacyModuleHeroVariant;
  stats?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function AdminSubpageShell({
  headline,
  subcopy,
  variant = "default",
  stats,
  action,
  children,
}: AdminSubpageShellProps) {
  return (
    <div className="space-y-4 pb-20 md:pb-8">
      <div className="flex items-center justify-between gap-3">
        <AdminBackLink />
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <ModuleDashboardHero
        module="Admin"
        pillar="admin"
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
