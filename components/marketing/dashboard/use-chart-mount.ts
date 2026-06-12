"use client";

import { useEffect, useState } from "react";

/**
 * Tiny hook used by every Recharts wrapper in this folder to defer the
 * actual chart render until after the component has mounted.
 *
 * Why: Recharts' `<ResponsiveContainer>` measures its parent via
 * `ResizeObserver`. During Next.js SSR there is no DOM to measure, so
 * Recharts logs a noisy `width(-1) height(-1)` warning on every render
 * pass. Skipping the chart on the server (and rendering a same-size
 * placeholder) is the documented mitigation that also preserves the
 * page's layout to avoid CLS.
 */
export function useChartMount(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
