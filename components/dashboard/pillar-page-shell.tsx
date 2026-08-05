import { PILLAR_PAGE_SHELL } from "@/lib/pillars/theme";
import { cn } from "@/lib/utils/cn";

/** Standardized pillar page wrapper — max width and responsive padding. */
export function PillarPageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(PILLAR_PAGE_SHELL, className)}>{children}</div>;
}
