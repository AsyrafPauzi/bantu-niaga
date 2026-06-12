"use client";

/**
 * Tiny inline sparkline used inside `<KpiTileBig>`. No axes, no grid,
 * just a stroke + soft area fill so the eye picks up the trend at a
 * glance.
 */
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { SparkPoint } from "@/lib/marketing/dashboard-queries";
import { useChartMount } from "@/components/marketing/dashboard/use-chart-mount";

interface SparklineMiniProps {
  data: SparkPoint[];
  color: string;
  height?: number;
  /**
   * Stable id used as the linear gradient id so multiple sparklines
   * on the same screen don't collide.
   */
  gradientId: string;
}

export function SparklineMini({
  data,
  color,
  height = 36,
  gradientId,
}: SparklineMiniProps) {
  const mounted = useChartMount();
  const series = data.length === 0 ? [{ day: "0", value: 0 }] : data;
  return (
    <div
      data-testid="kpi-sparkline"
      className="w-full"
      style={{ height }}
      aria-hidden="true"
    >
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={series}
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      ) : null}
    </div>
  );
}
