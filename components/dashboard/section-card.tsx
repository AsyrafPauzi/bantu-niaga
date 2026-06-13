import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Titled card with optional subtitle + right-aligned action — the workhorse
 * container for every grouped block on the pillar dashboards.
 */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-cream-200 p-4 sm:p-5 dark:border-hairline-dark">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink dark:text-cream-100">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <CardBody className={cn("flex-1", bodyClassName)}>{children}</CardBody>
    </Card>
  );
}
