"use client";

import { useMode } from "@/lib/use-mode";
import { MobileShell } from "./mobile-shell";
import { DesktopShell } from "./desktop-shell";
import type { ReactNode } from "react";

/**
 * Renders the right shell (Mobile PWA vs Desktop ERP) based on viewport.
 *
 * This is the SINGLE switching mechanism between modes. Pages should never
 * branch on viewport ad-hoc — they should rely on this shell + ask
 * `useMode()` only for intra-page component variants.
 */
export function AdaptiveShell({ children }: { children: ReactNode }) {
  const mode = useMode();
  return mode === "mobile" ? (
    <MobileShell>{children}</MobileShell>
  ) : (
    <DesktopShell>{children}</DesktopShell>
  );
}
