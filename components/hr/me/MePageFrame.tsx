import type { ReactNode } from "react";
import { HrMeSubpageShell } from "@/components/hr/me/HrMeSubpageShell";

/** Shared chrome for /hr/me routes — matches Finance invoice subpage layout. */
export function MePageFrame({
  pathname,
  title,
  subtitle,
  backHref = "/hr/me",
  showBack = true,
  action,
  stats,
  children,
  className,
}: {
  pathname: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  showBack?: boolean;
  action?: ReactNode;
  stats?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <HrMeSubpageShell
      pathname={pathname}
      headline={title}
      subcopy={subtitle ?? ""}
      backHref={backHref}
      showBack={showBack}
      action={action}
      stats={stats}
      className={className}
    >
      {children}
    </HrMeSubpageShell>
  );
}
