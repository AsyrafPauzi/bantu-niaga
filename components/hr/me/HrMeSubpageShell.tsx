import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import {
  ModuleDashboardHero,
  type LegacyModuleHeroVariant,
} from "@/components/dashboard/module-layout";
import { MeMobileSubnav } from "@/components/hr/me/MeMobileSubnav";
import { cn } from "@/lib/utils/cn";

interface HrMeSubpageShellProps {
  pathname: string;
  headline: string;
  subcopy: string;
  variant?: LegacyModuleHeroVariant;
  stats?: ReactNode;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
  showBack?: boolean;
  children: ReactNode;
  className?: string;
}

export function HrMeSubpageShell({
  pathname,
  headline,
  subcopy,
  variant = "default",
  stats,
  action,
  backHref = "/hr/me",
  backLabel = "My HR",
  showBack = true,
  children,
  className,
}: HrMeSubpageShellProps) {
  return (
    <div className={cn("space-y-4 pb-20 md:pb-8", className)}>
      <MeMobileSubnav pathname={pathname} />

      <div className="flex items-center justify-between gap-3">
        {showBack ? (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F766E] dark:text-teal-300"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            {backLabel}
          </Link>
        ) : (
          <span className="text-sm font-semibold text-ink-muted dark:text-cream-400">
            Staff portal
          </span>
        )}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <ModuleDashboardHero
        module="HR"
        pillar="hr"
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
