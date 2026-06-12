/**
 * Big KPI tile used in the top band of the Marketing dashboard.
 *
 * Replaces the older `KpiCard` for the dashboard hero row. Carries:
 *   - Top 4-pixel coloured stripe (brand / accent / success / info /
 *     warning) so the row reads visually saturated.
 *   - Big value (text-4xl), uppercase label, optional sublabel.
 *   - Delta vs last period pill (status-success for positive,
 *     status-danger for negative; muted "no change" otherwise).
 *   - Optional inline 7-day sparkline.
 *
 * Server-renderable; the embedded `<SparklineMini>` is "use client".
 */
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { SparklineMini } from "@/components/marketing/dashboard/SparklineMini";
import { DASHBOARD_COLORS } from "@/lib/marketing/dashboard-colors";
import type { SparkPoint } from "@/lib/marketing/dashboard-queries";

export type KpiTileTone = "brand" | "accent" | "success" | "info" | "warning";

const STRIPE: Record<KpiTileTone, string> = {
  brand: "bg-brand-500",
  accent: "bg-accent-500",
  success: "bg-status-success",
  info: "bg-[#2D6A8A]",
  warning: "bg-[#D89614]",
};

const SPARK_COLOR: Record<KpiTileTone, string> = {
  brand: DASHBOARD_COLORS.brand[500],
  accent: DASHBOARD_COLORS.accent[500],
  success: DASHBOARD_COLORS.status.success,
  info: DASHBOARD_COLORS.status.info,
  warning: DASHBOARD_COLORS.status.warning,
};

export interface DeltaInfo {
  /** Numeric delta (already computed by the caller). */
  value: number;
  /** Pre-formatted display, e.g. "+12.4%" or "+RM 230". */
  display: string;
  /** Label for what the delta is relative to, e.g. "vs last month". */
  label?: string;
}

interface KpiTileBigProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: KpiTileTone;
  delta?: DeltaInfo | null;
  spark?: SparkPoint[];
  /** Stable id-friendly key — used to build the gradient id. */
  sparkKey?: string;
  className?: string;
}

function deltaColors(value: number): {
  text: string;
  bg: string;
  Icon: typeof ArrowUpRight;
} {
  if (value > 0) {
    return {
      text: "text-status-success",
      bg: "bg-status-success/10 dark:bg-status-success/20",
      Icon: ArrowUpRight,
    };
  }
  if (value < 0) {
    return {
      text: "text-status-danger",
      bg: "bg-status-danger/10 dark:bg-status-danger/20",
      Icon: ArrowDownRight,
    };
  }
  return {
    text: "text-ink-muted dark:text-cream-400",
    bg: "bg-cream-200 dark:bg-hairline-dark/60",
    Icon: ArrowRight,
  };
}

export function KpiTileBig({
  label,
  value,
  sublabel,
  tone = "brand",
  delta,
  spark,
  sparkKey,
  className,
}: KpiTileBigProps) {
  const sparkColor = SPARK_COLOR[tone];
  const gradientId = `spark-${sparkKey ?? label.replace(/\W+/g, "-").toLowerCase()}`;

  const deltaInfo = delta ? deltaColors(delta.value) : null;

  return (
    <Card
      data-testid="kpi-tile-big"
      data-tone={tone}
      className={cn("relative flex h-full min-h-[8rem] flex-col overflow-hidden", className)}
    >
      <div
        aria-hidden="true"
        data-testid="kpi-stripe"
        className={cn("h-1 w-full", STRIPE[tone])}
      />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p
          data-testid="kpi-label"
          className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400"
        >
          {label}
        </p>
        <p
          data-testid="kpi-value"
          className="mt-1 text-3xl font-semibold leading-tight text-ink dark:text-cream-100 sm:text-4xl"
        >
          {value}
        </p>
        {sublabel ? (
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            {sublabel}
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          {delta && deltaInfo ? (
            <span
              data-testid="kpi-delta"
              data-direction={
                delta.value > 0 ? "up" : delta.value < 0 ? "down" : "flat"
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                deltaInfo.text,
                deltaInfo.bg,
              )}
            >
              <deltaInfo.Icon className="h-3 w-3" strokeWidth={2.5} />
              <span>{delta.display}</span>
              {delta.label ? (
                <span className="text-[10px] text-ink-muted dark:text-cream-400">
                  {delta.label}
                </span>
              ) : null}
            </span>
          ) : (
            <span />
          )}
          {spark && spark.length > 0 ? (
            <div className="ml-auto w-24 sm:w-28">
              <SparklineMini
                data={spark}
                color={sparkColor}
                gradientId={gradientId}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
