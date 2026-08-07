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
  children: React.ReactNode;
}

export function AdminSubpageShell({
  headline,
  subcopy,
  variant = "default",
  stats,
  children,
}: AdminSubpageShellProps) {
  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <AdminBackLink />
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
