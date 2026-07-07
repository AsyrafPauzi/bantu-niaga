"use client";

import { useMode } from "@/lib/use-mode";
import { MobileShell } from "./mobile-shell";
import { DesktopShell } from "./desktop-shell";
import type { ReactNode } from "react";
import type { TierKey } from "@/lib/settings/plans";
import type { BusinessMembership } from "@/lib/auth/memberships";

/**
 * Renders the right shell (Mobile PWA vs Desktop ERP) based on viewport.
 *
 * This is the SINGLE switching mechanism between modes. Pages should never
 * branch on viewport ad-hoc — they should rely on this shell + ask
 * `useMode()` only for intra-page component variants.
 *
 * The `tier` prop flows down to both shells so they can mark pillars
 * that the current plan does not unlock (see `lib/auth/entitlements.ts`).
 */
export function AdaptiveShell({
  tier,
  memberships,
  children,
}: {
  tier: TierKey;
  memberships: BusinessMembership[];
  children: ReactNode;
}) {
  const mode = useMode();
  return mode === "mobile" ? (
    <MobileShell tier={tier} memberships={memberships}>
      {children}
    </MobileShell>
  ) : (
    <DesktopShell tier={tier} memberships={memberships}>
      {children}
    </DesktopShell>
  );
}
