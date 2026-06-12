import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

/**
 * Marketing M6 KPI card primitive.
 *
 * Presentational only — receives a pre-formatted value string from the
 * page (the page coerces the bigints / numerics returned by the
 * `marketing_kpi_snapshot` RPC via `lib/marketing/metrics.ts`).
 *
 * Variants:
 *   - tone="default"  — neutral cream card (total customers).
 *   - tone="positive" — brand green accent strip (new this month).
 *   - tone="vip"      — gold accent strip (vip count).
 *   - tone="warning"  — amber accent strip (at-risk count).
 *   - tone="muted"    — grey accent strip (dormant count).
 *
 * Sub-label is optional and renders below the big number (e.g.
 * "tagged via auto-segmentation").
 */
export type KpiTone = "default" | "positive" | "vip" | "warning" | "muted";

const TONE_STRIP: Record<KpiTone, string> = {
  default: "bg-cream-200 dark:bg-hairline-dark",
  positive: "bg-brand-700",
  vip: "bg-accent-700",
  warning: "bg-[#8C5C0A]",
  muted: "bg-ink-muted",
};

interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: KpiTone;
  icon?: ReactNode;
  className?: string;
}

export function KpiCard({
  label,
  value,
  sublabel,
  tone = "default",
  icon,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <div
        aria-hidden="true"
        className={cn("absolute inset-y-0 left-0 w-1.5", TONE_STRIP[tone])}
      />
      <CardBody className="pl-5">
        <div className="flex items-start justify-between gap-2">
          <p
            data-kpi-label
            className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400"
          >
            {label}
          </p>
          {icon ? (
            <span className="text-ink-muted dark:text-cream-400">{icon}</span>
          ) : null}
        </div>
        <p
          data-kpi-value
          className="mt-2 text-3xl font-semibold text-ink dark:text-cream-100"
        >
          {value}
        </p>
        {sublabel ? (
          <p
            data-kpi-sublabel
            className="mt-1 text-xs text-ink-muted dark:text-cream-400"
          >
            {sublabel}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
