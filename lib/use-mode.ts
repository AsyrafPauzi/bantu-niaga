"use client";

import { useEffect, useState } from "react";
import { MOBILE_MAX_PX } from "@/lib/navigation/breakpoints";

export type Mode = "mobile" | "desktop";

/**
 * Single switching mechanism between Mobile PWA shell and Desktop ERP shell.
 * Phones (< 768px) use mobile shell; tablet and desktop use desktop shell.
 */
export function useMode(): Mode {
  const [mode, setMode] = useState<Mode>("desktop");

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX_PX}px)`);
    const update = () => setMode(mql.matches ? "mobile" : "desktop");

    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return mode;
}
