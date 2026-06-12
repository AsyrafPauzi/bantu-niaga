"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DASHBOARD_COLORS } from "@/lib/marketing/dashboard-colors";
import type { SpendBucket } from "@/lib/marketing/dashboard-queries";
import { useChartMount } from "@/components/marketing/dashboard/use-chart-mount";

interface SpendDistributionBarProps {
  data: SpendBucket[];
  height?: number;
}

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ value?: number | string }>;
}

function CustomTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const v = payload[0]?.value;
  return (
    <div className="rounded-md border border-hairline-light bg-panel-light px-3 py-1.5 text-xs shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <p className="font-medium text-ink dark:text-cream-100">{label}</p>
      <p className="text-ink-muted dark:text-cream-300">
        <strong>{v}</strong> customers
      </p>
    </div>
  );
}

export function SpendDistributionBar({
  data,
  height = 220,
}: SpendDistributionBarProps) {
  const mounted = useChartMount();
  const empty = data.every((b) => b.count === 0);
  if (empty) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-hairline-light bg-cream-50 p-6 text-center dark:border-hairline-dark dark:bg-panel-dark/40">
        <p className="text-sm font-medium text-ink dark:text-cream-100">
          No spend data
        </p>
        <p className="text-xs text-ink-muted dark:text-cream-400">
          Connect Operations / Finance events and totals will land here.
        </p>
      </div>
    );
  }

  if (!mounted) {
    return <div style={{ height }} className="w-full" aria-hidden="true" />;
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
          barCategoryGap={6}
        >
          <CartesianGrid
            horizontal={false}
            stroke={DASHBOARD_COLORS.cream[300]}
            strokeDasharray="3 3"
            className="dark:opacity-40"
          />
          <XAxis
            type="number"
            stroke={DASHBOARD_COLORS.ink.muted}
            fontSize={11}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="bucket"
            stroke={DASHBOARD_COLORS.ink.muted}
            fontSize={11}
            width={88}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: DASHBOARD_COLORS.brand[50] }}
          />
          <Bar
            dataKey="count"
            fill={DASHBOARD_COLORS.brand[500]}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
