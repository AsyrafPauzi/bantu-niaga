import type { Metadata } from "next";
import { AdaptiveShell } from "@/components/shells/adaptive-shell";
import { SessionRegistrar } from "@/components/auth/SessionRegistrar";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadUserMemberships } from "@/lib/auth/memberships";
import {
  canCreateOwnedBusiness,
} from "@/lib/auth/owned-business-limits";
import { countOwnedBusinesses } from "@/lib/auth/count-owned-businesses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TierKey } from "@/lib/settings/plans";
import { ImpersonationBanner } from "@/components/super-admin/ImpersonationBanner";

// Authenticated app surface — keep it out of search engines + previews.
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

/**
 * App-shell layout. Resolves the current business's tier on the server
 * and forwards it to the shell so the sidebar (desktop + mobile) can
 * mark pillars locked for the user's plan.
 *
 * Falls back to `starter` if the session is missing — the middleware
 * separately redirects unauthenticated users to `/sign-in`, so reaching
 * this layout without a session only happens during the brief window
 * after sign-out; the safest default is the most-restrictive tier.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let tier: TierKey = "starter";
  let memberships: Awaited<ReturnType<typeof loadUserMemberships>> = [];
  let canCreateCompany = true;
  try {
    const user = await getCurrentUser();
    const supabase = await createSupabaseServerClient();
    const [{ data }, loadedMemberships, ownedCount] = await Promise.all([
      supabase
        .from("businesses")
        .select("tier")
        .eq("id", user.businessId)
        .maybeSingle(),
      loadUserMemberships(user.id, user.businessId),
      countOwnedBusinesses(user.id),
    ]);
    if (data?.tier) tier = data.tier as TierKey;
    memberships = loadedMemberships;
    canCreateCompany = canCreateOwnedBusiness(ownedCount);
  } catch (e) {
    if (!(e instanceof UnauthorizedError)) throw e;
  }

  return (
    <AdaptiveShell
      tier={tier}
      memberships={memberships}
      canCreateCompany={canCreateCompany}
    >
      <SessionRegistrar />
      <ImpersonationBanner />
      {children}
    </AdaptiveShell>
  );
}
