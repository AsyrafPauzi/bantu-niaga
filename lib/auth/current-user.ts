/**
 * Bantu Niaga — current-user resolver (server-side).
 *
 * Resolves the calling user's `Role` and `business_id` for use by:
 *   - `<RequirePermission>` (UI hide layer)
 *   - API route handlers (fast-fail layer)
 *   - Anywhere we need to scope queries by tenant
 *
 * STUB BEHAVIOUR (v0):
 *   The Phase 0 scaffold ships *before* the Supabase Auth UI is wired. So
 *   when there's no session we deliberately return a clearly-marked
 *   `isStub: true` owner identity scoped to the all-zeros sentinel
 *   business_id. This lets the rest of the app render in dev without a
 *   real login flow.
 *
 *   The stub is gated by `isStub: true` on the returned object so callers
 *   (and any audit tooling) can detect it.
 *
 * TODO: remove stub when sign-in flow lands. Once Supabase Auth is wired,
 * an unauthenticated request should redirect to `/sign-in` (or return
 * 401 from API routes), not fall back to a stub.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLES, type Role } from "@/lib/permissions";

export interface CurrentUser {
  role: Role;
  businessId: string;
  isStub: boolean;
}

const STUB_BUSINESS_ID = "00000000-0000-0000-0000-000000000000";

const STUB_USER: CurrentUser = {
  role: "owner",
  businessId: STUB_BUSINESS_ID,
  isStub: true,
};

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return STUB_USER;

    const { data: profile, error } = await supabase
      .from("users")
      .select("role, business_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile) return STUB_USER;
    if (!isRole(profile.role)) return STUB_USER;
    if (typeof profile.business_id !== "string") return STUB_USER;

    return {
      role: profile.role,
      businessId: profile.business_id,
      isStub: false,
    };
  } catch {
    // Supabase env vars missing or network failure during local dev: fall
    // back to the stub so pages still render.
    return STUB_USER;
  }
}
