"use client";

import { useMode } from "@/lib/use-mode";
import type { ReactNode } from "react";

/**
 * Renders the desktop calendar OR the mobile list based on viewport.
 * Mirrors the `<CustomerListAdaptive>` pattern: both subtrees are
 * pre-rendered server-side; the client picks one after hydration so
 * the first paint is still correct.
 */

export function ContentCalendarAdaptive({
  desktop,
  mobile,
}: {
  desktop: ReactNode;
  mobile: ReactNode;
}) {
  const mode = useMode();
  return <>{mode === "mobile" ? mobile : desktop}</>;
}
