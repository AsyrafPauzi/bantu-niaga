"use client";

import { useMode } from "@/lib/use-mode";
import { MobileShell } from "./mobile-shell";
import { DesktopShell } from "./desktop-shell";
import type { ReactNode } from "react";
import type { TierKey } from "@/lib/settings/plans";
import type { BusinessMembership } from "@/lib/auth/memberships";
import type { BusinessType } from "@/lib/onboarding/plan-quiz";
import type { Role } from "@/lib/permissions";

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
  canCreateCompany,
  businessType = "other",
  role = "manager",
  children,
}: {
  tier: TierKey;
  memberships: BusinessMembership[];
  canCreateCompany: boolean;
  businessType?: BusinessType;
  role?: Role;
  children: ReactNode;
}) {
  const mode = useMode();
  return mode === "mobile" ? (
    <MobileShell
      tier={tier}
      memberships={memberships}
      canCreateCompany={canCreateCompany}
      businessType={businessType}
      role={role}
    >
      {children}
    </MobileShell>
  ) : (
    <DesktopShell
      tier={tier}
      memberships={memberships}
      canCreateCompany={canCreateCompany}
      businessType={businessType}
      role={role}
    >
      {children}
    </DesktopShell>
  );
}
