import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { SecurityView } from "@/components/settings/SecurityView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensureCurrentSession,
  getCurrentSessionId,
  listActiveSessions,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/auth/sessions";

export const metadata = { title: "Security settings" };
export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const h = await headers();
  const meta = {
    userAgent: h.get("user-agent"),
    forwardedFor: h.get("x-forwarded-for"),
    realIp: h.get("x-real-ip"),
  };

  const supabase = await createSupabaseServerClient();
  const [{ data: authUser }, profileRes, factorsRes, auditRes] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("users")
        .select("email, last_password_change_at, display_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.auth.mfa.listFactors(),
      supabase
        .from("audit_log")
        .select("id, action, entity_type, diff, created_at, actor_user_id")
        .eq("business_id", user.businessId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  let currentSessionId = await getCurrentSessionId();
  try {
    const ensured = await ensureCurrentSession(supabase, user.id, meta);
    currentSessionId = ensured.sessionId;
    const jar = await cookies();
    const existingCookie = jar.get(SESSION_COOKIE_NAME)?.value;
    if (existingCookie !== ensured.sessionId) {
      jar.set(SESSION_COOKIE_NAME, ensured.sessionId, sessionCookieOptions());
    }
  } catch {
    // Table may not exist until migration is applied.
  }

  let sessions: Array<{
    id: string;
    device_label: string;
    location_label: string | null;
    last_seen_at: string;
    created_at: string;
    is_current: boolean;
  }> = [];

  try {
    const rows = await listActiveSessions(supabase, user.id);
    sessions = rows.map((s) => ({
      ...s,
      is_current: s.id === currentSessionId,
    }));
  } catch {
    sessions = [];
  }

  const email = authUser.user?.email ?? profileRes.data?.email ?? "—";
  const lastPwdChange = profileRes.data?.last_password_change_at ?? null;
  const factors = (factorsRes.data?.totp ?? []).map((f) => ({
    id: f.id,
    name: f.friendly_name ?? "Authenticator",
    status: f.status as "verified" | "unverified",
    created_at: f.created_at,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Security"
        description={email}
      />

      <SecurityView
        email={email}
        lastPasswordChangeAt={lastPwdChange}
        initialFactors={factors}
        initialAudit={auditRes.data ?? []}
        initialSessions={sessions}
        sessionListLimit={10}
      />
    </>
  );
}
