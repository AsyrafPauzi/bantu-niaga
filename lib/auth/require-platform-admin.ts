/**
 * Bantu Niaga — Super-admin (platform-admin) guard.
 *
 * Mirrors `lib/auth/require-pillar.ts` but for the cross-tenant super-admin
 * route group (`app/(super-admin)/super-admin/**`).
 *
 * Behaviour:
 *   - No session                         → redirect to `/sign-in`.
 *   - Session present, NOT a platform admin → redirect to `/home` with
 *     `?reason=not_platform_admin` so the tenant app can show a toast.
 *   - Platform admin                     → return the admin's identity.
 *
 * Membership is resolved by `public.is_platform_admin()` (helper introduced
 * in migration 15). That function checks `public.platform_admins` for an
 * unrevoked row keyed on `auth.uid()`.
 */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface PlatformAdmin {
  userId: string;
  email: string;
  displayName: string | null;
}

export class NotPlatformAdminError extends Error {
  constructor(message?: string) {
    super(message ?? "not_platform_admin");
    this.name = "NotPlatformAdminError";
  }
}

export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?reason=not_platform_admin");
  }

  // RLS on platform_admins lets the row owner read their own row; we look
  // it up with .maybeSingle so a missing row gracefully redirects.
  const { data, error } = await supabase
    .from("platform_admins")
    .select("user_id, email, display_name, revoked_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) {
    redirect("/home?reason=not_platform_admin");
  }

  return {
    userId: data.user_id as string,
    email: data.email as string,
    displayName: (data.display_name as string | null) ?? null,
  };
}

/**
 * Soft check — does not redirect. Used by the tenant shell to decide
 * whether to show the "Switch to super-admin" entry point.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
