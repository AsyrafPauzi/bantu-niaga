import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SecurityView } from "@/components/settings/SecurityView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Security settings" };
export const dynamic = "force-dynamic";

function parseUserAgent(ua: string | null): string {
  if (!ua) return "This browser";
  if (/iPhone|iPad/i.test(ua)) return "iPhone · Safari";
  if (/Android/i.test(ua)) return "Android phone";
  if (/Mac OS X/i.test(ua)) {
    if (/Chrome/i.test(ua)) return "Mac · Chrome";
    if (/Safari/i.test(ua)) return "Mac · Safari";
    return "Mac";
  }
  if (/Windows/i.test(ua)) {
    if (/Edg/i.test(ua)) return "Windows · Edge";
    if (/Chrome/i.test(ua)) return "Windows · Chrome";
    return "Windows";
  }
  if (/Linux/i.test(ua)) return "Linux";
  return "This browser";
}

export default async function SecuritySettingsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

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
        .limit(20),
    ]);

  const email = authUser.user?.email ?? profileRes.data?.email ?? "—";
  const lastPwdChange = profileRes.data?.last_password_change_at ?? null;
  const factors = (factorsRes.data?.totp ?? []).map((f) => ({
    id: f.id,
    name: f.friendly_name ?? "Authenticator",
    status: f.status as "verified" | "unverified",
    created_at: f.created_at,
  }));

  const h = await headers();
  const currentDevice = {
    label: parseUserAgent(h.get("user-agent")),
    location: "Singapore region",
  };

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to settings
      </Link>

      <PageHeader
        eyebrow="Settings · Security"
        title="Security settings"
        description="Two-factor auth, password rotation, active sessions, and the audit log."
      />

      <SecurityView
        email={email}
        lastPasswordChangeAt={lastPwdChange}
        initialFactors={factors}
        initialAudit={auditRes.data ?? []}
        currentDevice={currentDevice}
      />
    </div>
  );
}
