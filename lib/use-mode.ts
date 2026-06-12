"use client";

import { useEffect, useState } from "react";

export type Mode = "mobile" | "desktop";

const MOBILE_BREAKPOINT = 1024;

/**
 * Single switching mechanism between Mobile PWA shell and Desktop ERP shell.
 * See `docs/architecture/dual-mode.md` and `docs/architecture/tech-stack.md` §2.
 *
 * Pages should NOT branch on viewport ad-hoc — they should ask `useMode()`.
 */
export function useMode(): Mode {
  const [mode, setMode] = useState<Mode>("desktop");

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setMode(mql.matches ? "mobile" : "desktop");

    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return mode;
}
