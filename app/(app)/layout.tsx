import type { Metadata } from "next";
import { AdaptiveShell } from "@/components/shells/adaptive-shell";
import { SessionRegistrar } from "@/components/auth/SessionRegistrar";
import { ProductAnalytics } from "@/components/privacy/ProductAnalytics";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadUserMemberships } from "@/lib/auth/memberships";
import {
  canCreateOwnedBusiness,
} from "@/lib/auth/owned-business-limits";
import { countOwnedBusinesses } from "@/lib/auth/count-owned-businesses";
import { isStandaloneDeployment } from "@/lib/platform/deployment";
import { getConsentFlags } from "@/lib/privacy/consent";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TierKey } from "@/lib/settings/plans";
import { ImpersonationBanner } from "@/components/super-admin/ImpersonationBanner";
import { BasicTrialBannerHost } from "@/components/settings/BasicTrialBannerHost";
import { PastDueBanner } from "@/components/settings/PastDueBanner";
import { TenantI18nProvider } from "@/components/i18n/TenantI18nProvider";
import { normalizeBusinessType } from "@/lib/operations/vertical";
import type { BusinessType } from "@/lib/onboarding/plan-quiz";
import type { Role } from "@/lib/permissions";
import { parseAppLocale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

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
  let analyticsConsent = false;
  let businessType: BusinessType = "other";
  let role: Role = "manager";
  let subscriptionStatus: string = "active";
  let locale = parseAppLocale("en");
  try {
    const user = await getCurrentUser();
    role = user.role;
    const supabase = await createSupabaseServerClient();
    const [{ data }, loadedMemberships, ownedCount, consentFlags, { data: profile }] =
      await Promise.all([
      supabase
        .from("businesses")
        .select("tier, business_type, subscription_status")
        .eq("id", user.businessId)
        .maybeSingle(),
      loadUserMemberships(user.id, user.businessId),
      countOwnedBusinesses(user.id),
      getConsentFlags(user.id),
      supabase
        .from("users")
        .select("preferred_locale")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    if (data?.tier) tier = data.tier as TierKey;
    if (data?.subscription_status) {
      subscriptionStatus = data.subscription_status;
    }
    locale = parseAppLocale(profile?.preferred_locale);
    businessType = normalizeBusinessType(data?.business_type);
    memberships = loadedMemberships;
    canCreateCompany =
      !isStandaloneDeployment() && canCreateOwnedBusiness(ownedCount);
    analyticsConsent = consentFlags.analytics;
  } catch (e) {
    if (!(e instanceof UnauthorizedError)) throw e;
  }

  const messages = getMessages(locale);

  return (
    <TenantI18nProvider locale={locale} messages={messages}>
      <AdaptiveShell
        tier={tier}
        memberships={memberships}
        canCreateCompany={canCreateCompany}
        businessType={businessType}
        role={role}
      >
        <SessionRegistrar />
        <ProductAnalytics enabled={analyticsConsent} />
        <ImpersonationBanner />
        <BasicTrialBannerHost />
        {subscriptionStatus === "past_due" ? <PastDueBanner /> : null}
        {children}
      </AdaptiveShell>
    </TenantI18nProvider>
  );
}
