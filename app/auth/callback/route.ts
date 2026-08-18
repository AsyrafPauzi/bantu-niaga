import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import {
  registerNewSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/sessions";
import { resolveGoogleCallbackTarget } from "@/lib/auth/google-callback";
import { sanitizeAuthNextPath } from "@/lib/auth/social-login";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /auth/callback — handles Supabase auth returns:
 *   - email links (recovery, signup confirm, magic link)
 *   - Google OAuth (social login)
 *
 * Existing `public.users` rows continue to `next`. New Google users keep
 * the session and finish on `/sign-up/complete`.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeAuthNextPath(url.searchParams.get("next"));
  const error = url.searchParams.get("error_description");
  const oauthError = url.searchParams.get("error");

  if (error || oauthError) {
    const redirect = new URL("/sign-in", url.origin);
    redirect.searchParams.set(
      "auth_error",
      error ?? oauthError ?? "oauth_cancelled",
    );
    return NextResponse.redirect(redirect);
  }

  if (!code) {
    const redirect = new URL("/sign-in", url.origin);
    redirect.searchParams.set("auth_error", "missing_code");
    return NextResponse.redirect(redirect);
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    const redirect = new URL("/sign-in", url.origin);
    redirect.searchParams.set("auth_error", exchangeError.message);
    return NextResponse.redirect(redirect);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirect = new URL("/sign-in", url.origin);
    redirect.searchParams.set("auth_error", "missing_code");
    return NextResponse.redirect(redirect);
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    const redirect = new URL("/sign-in", url.origin);
    redirect.searchParams.set("auth_error", "missing_code");
    return NextResponse.redirect(redirect);
  }

  let emailOwnerId: string | null = null;
  if (!profile?.id && user.email) {
    const admin = createServiceRoleClient();
    const email = user.email.trim().toLowerCase();
    const { data: emailOwner } = await admin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    emailOwnerId = emailOwner?.id ?? null;
  }

  const target = resolveGoogleCallbackTarget({
    authUserId: user.id,
    profileId: profile?.id ?? null,
    emailOwnerId,
    nextPath: next,
  });

  if (target.kind === "email_taken") {
    await supabase.auth.signOut();
    const redirect = new URL("/sign-in", url.origin);
    redirect.searchParams.set("auth_error", "email_taken");
    return NextResponse.redirect(redirect);
  }

  if (target.kind === "complete") {
    return NextResponse.redirect(new URL("/sign-up/complete", url.origin));
  }

  const h = await headers();
  let sessionId: string | undefined;
  try {
    sessionId = await registerNewSession(supabase, user.id, {
      userAgent: h.get("user-agent"),
      forwardedFor: h.get("x-forwarded-for"),
      realIp: h.get("x-real-ip"),
    });
  } catch {
    // Session tracking is best-effort; auth still succeeds.
  }

  const response = NextResponse.redirect(new URL(target.nextPath, url.origin));
  if (sessionId) {
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
  }
  return response;
}
