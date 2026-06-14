import { getActiveImpersonation } from "@/lib/auth/impersonation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ImpersonationBannerClient } from "./ImpersonationBannerClient";

/**
 * Server component. Renders a sticky yellow banner at the top of every
 * tenant-app page whenever a platform admin is impersonating a tenant
 * user. The banner is invisible (returns null) under normal usage so the
 * tenant UI never wastes vertical space.
 */
export async function ImpersonationBanner() {
  const tok = await getActiveImpersonation();
  if (!tok) return null;

  let displayName = tok.targetDisplayName ?? null;
  let email: string | null = null;
  let businessName: string | null = null;

  try {
    const svc = createServiceRoleClient();
    const { data: u } = await svc
      .from("users")
      .select("display_name, email, business_id, businesses(name)")
      .eq("id", tok.targetUserId)
      .maybeSingle();
    if (u) {
      displayName = (u.display_name as string | null) ?? displayName;
      email = (u.email as string | null) ?? null;
      const biz = u.businesses as
        | { name: string }
        | { name: string }[]
        | null;
      const bizRow = Array.isArray(biz) ? biz[0] : biz;
      businessName = bizRow?.name ?? null;
    }
  } catch {
    // best-effort enrichment only
  }

  return (
    <ImpersonationBannerClient
      adminEmail={tok.adminEmail}
      targetName={displayName ?? email ?? "Tenant user"}
      targetEmail={email}
      businessName={businessName}
      expiresAt={tok.expiresAt}
    />
  );
}
