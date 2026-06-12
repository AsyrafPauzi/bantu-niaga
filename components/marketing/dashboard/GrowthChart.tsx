"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DASHBOARD_COLORS } from "@/lib/marketing/dashboard-colors";
import type { GrowthPoint } from "@/lib/marketing/dashboard-queries";
import { useChartMount } from "@/components/marketing/dashboard/use-chart-mount";

interface GrowthChartProps {
  data: GrowthPoint[];
  /** Height in pixels for the chart inner area. */
  height?: number;
}

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{
    name?: string;
    value?: number | string;
    dataKey?: string;
    color?: string;
  }>;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-hairline-light bg-panel-light px-3 py-2 text-xs shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <p className="font-medium text-ink dark:text-cream-100">{label}</p>
      <ul className="mt-1 space-y-0.5">
        {payload.map((entry) => (
          <li
            key={entry.dataKey}
            className="flex items-center gap-2 text-ink-muted dark:text-cream-300"
          >
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span>
              {entry.name}: <strong>{entry.value}</strong>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GrowthChart({ data, height = 260 }: GrowthChartProps) {
  const mounted = useChartMount();
  const empty = data.every((p) => p.total === 0 && p.newAdditions === 0);

  if (empty) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-hairline-light bg-cream-50 p-6 text-center dark:border-hairline-dark dark:bg-panel-dark/40">
        <p className="text-sm font-medium text-ink dark:text-cream-100">
          No customers yet
        </p>
        <p className="text-xs text-ink-muted dark:text-cream-400">
          Add your first customer to see growth here.
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
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={DASHBOARD_COLORS.cream[300]}
            className="dark:opacity-40"
          />
          <XAxis
            dataKey="monthLabel"
            stroke={DASHBOARD_COLORS.ink.muted}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: DASHBOARD_COLORS.cream[300] }}
          />
          <YAxis
            stroke={DASHBOARD_COLORS.ink.muted}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{
              stroke: DASHBOARD_COLORS.brand[200],
              strokeWidth: 1,
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{
              fontSize: 12,
              color: DASHBOARD_COLORS.ink.muted,
            }}
          />
          <Line
            type="monotone"
            dataKey="total"
            name="Cumulative customers"
            stroke={DASHBOARD_COLORS.brand[500]}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="newAdditions"
            name="New that month"
            stroke={DASHBOARD_COLORS.accent[500]}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
