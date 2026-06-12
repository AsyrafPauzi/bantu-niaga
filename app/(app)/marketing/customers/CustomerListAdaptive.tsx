"use client";

import { useMode } from "@/lib/use-mode";
import type { ReactNode } from "react";

/**
 * Tiny client switch so the customer list page (a server component)
 * can render *both* the desktop table and the mobile card list
 * pre-hydrated, and we pick the right one client-side.
 *
 * The server emits both subtrees so the first paint is correct under
 * SSR; `useMode()` then hides the one that doesn't match the viewport.
 * This avoids a round-trip for the data — the DB read happens once on
 * the server.
 */

export function CustomerListAdaptive({
  desktop,
  mobile,
}: {
  desktop: ReactNode;
  mobile: ReactNode;
}) {
  const mode = useMode();
  return <>{mode === "mobile" ? mobile : desktop}</>;
}
