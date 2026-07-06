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
  id?: string;
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
  id,
}: SectionCardProps) {
  return (
    <Card
      id={id}
      className={cn(
        "flex h-full flex-col rounded-[14px] border-[#E5E0D8] dark:border-hairline-dark",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#E5E0D8] px-5 py-4 pt-5 dark:border-hairline-dark sm:px-6">
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
