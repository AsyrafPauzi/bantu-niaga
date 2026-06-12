/**
 * Bantu Niaga — current-user resolver (server-side).
 *
 * Resolves the calling user's `Role` and `business_id` for use by:
 *   - `<RequirePermission>` (UI hide layer)
 *   - API route handlers (fast-fail layer)
 *   - Anywhere we need to scope queries by tenant
 *
 * Behaviour (M1 — Supabase Auth now wired):
 *   - When `auth.getUser()` returns a real session AND a matching row
 *     exists in `public.users`, returns `{ role, businessId, isStub:false }`.
 *   - When there is no session OR no matching profile, throws
 *     `UnauthorizedError`. Middleware redirects unauthenticated requests
 *     to `/sign-in` for app routes, so API handlers can rely on this
 *     throw to short-circuit with a 401.
 *
 * `STUB_USER` is still exported for tests that need a synthetic owner
 * identity without a real session — but production paths never see it.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLES, type Role } from "@/lib/permissions";

export interface CurrentUser {
  id: string;
  role: Role;
  businessId: string;
  isStub: boolean;
}

export class UnauthorizedError extends Error {
  readonly code: "no_session" | "no_profile";
  constructor(code: "no_session" | "no_profile", message?: string) {
    super(message ?? code);
    this.name = "UnauthorizedError";
    this.code = code;
  }
}

const STUB_BUSINESS_ID = "00000000-0000-0000-0000-000000000000";
const STUB_USER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Test-only stub owner. NOT used by any production code path — production
 * resolves real sessions or throws `UnauthorizedError`.
 */
export const STUB_USER: CurrentUser = {
  id: STUB_USER_ID,
  role: "owner",
  businessId: STUB_BUSINESS_ID,
  isStub: true,
};

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new UnauthorizedError("no_session", "No authenticated session.");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("role, business_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    throw new UnauthorizedError(
      "no_profile",
      "Authenticated user has no public.users profile row.",
    );
  }
  if (!isRole(profile.role) || typeof profile.business_id !== "string") {
    throw new UnauthorizedError(
      "no_profile",
      "User profile is missing role or business_id.",
    );
  }

  return {
    id: user.id,
    role: profile.role,
    businessId: profile.business_id,
    isStub: false,
  };
}
