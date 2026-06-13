import type { LucideIcon } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type DeltaTone = "success" | "danger" | "warning" | "neutral" | "brand";

const DELTA_TONE: Record<DeltaTone, string> = {
  success: "text-status-success",
  danger: "text-status-danger",
  warning: "text-[#8C5C0A] dark:text-[#F5C97A]",
  brand: "text-brand-700 dark:text-brand-200",
  neutral: "text-ink-muted dark:text-cream-400",
};

interface KpiTileProps {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: DeltaTone;
  helper?: string;
  icon?: LucideIcon;
  className?: string;
}

/**
 * Pillar dashboard KPI tile — mirrors the four-up KPI row used across every
 * pillar overview in the Pencil designs.
 */
export function KpiTile({
  label,
  value,
  delta,
  deltaTone = "success",
  helper,
  icon: Icon,
  className,
}: KpiTileProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
            {label}
          </p>
          {Icon ? (
            <span className="rounded-md bg-brand-50 p-1.5 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <Icon className="h-4 w-4" strokeWidth={2} />
            </span>
          ) : null}
        </div>
        <p className="text-3xl font-semibold tracking-tight text-ink dark:text-cream-100">
          {value}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {delta ? (
            <span className={cn("text-sm font-medium", DELTA_TONE[deltaTone])}>
              {delta}
            </span>
          ) : null}
          {helper ? (
            <span className="text-xs text-ink-muted dark:text-cream-400">
              {helper}
            </span>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
