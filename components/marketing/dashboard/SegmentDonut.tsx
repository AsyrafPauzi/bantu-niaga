"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { DASHBOARD_COLORS } from "@/lib/marketing/dashboard-colors";
import type { SegmentSlice } from "@/lib/marketing/dashboard-queries";
import { useChartMount } from "@/components/marketing/dashboard/use-chart-mount";

interface SegmentDonutProps {
  slices: SegmentSlice[];
  height?: number;
}

export function SegmentDonut({ slices, height = 220 }: SegmentDonutProps) {
  const mounted = useChartMount();
  const total = slices.reduce((s, slice) => s + slice.count, 0);
  const isEmpty = total === 0;

  const data = isEmpty
    ? [{ segment: "empty", label: "No data", count: 1, color: DASHBOARD_COLORS.cream[300] }]
    : slices.filter((s) => s.count > 0);

  return (
    <div data-testid="segment-donut" className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div
        style={{ height, width: height }}
        className="relative shrink-0 self-center"
      >
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((entry, idx) => (
                <Cell
                  key={`segment-${idx}`}
                  data-segment={
                    "segment" in entry ? entry.segment : "empty"
                  }
                  fill={entry.color}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        ) : null}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-ink dark:text-cream-100">
            {total.toLocaleString("en-MY")}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-ink-muted dark:text-cream-400">
            tagged
          </span>
        </div>
      </div>
      <ul
        data-testid="segment-legend"
        className="flex-1 grid grid-cols-1 gap-2 text-sm sm:grid-cols-1"
      >
        {slices.map((slice) => (
          <li
            key={slice.segment}
            data-segment={slice.segment}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                aria-hidden="true"
                data-testid="segment-swatch"
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="truncate text-ink dark:text-cream-100">
                {slice.label}
              </span>
            </div>
            <div className="flex shrink-0 items-baseline gap-1">
              <span className="font-semibold text-ink dark:text-cream-100">
                {slice.count.toLocaleString("en-MY")}
              </span>
              <span className="text-xs text-ink-muted dark:text-cream-400">
                · {slice.pct.toFixed(1)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
