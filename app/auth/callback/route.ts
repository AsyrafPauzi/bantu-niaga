import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import {
  registerNewSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/sessions";
import { sanitizeAuthNextPath } from "@/lib/auth/social-login";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /auth/callback — handles Supabase auth returns:
 *   - email links (recovery, signup confirm, magic link)
 *   - Google OAuth (social login)
 *
 * We swap the `code` for a session cookie and forward to `next`. Users
 * without a `public.users` profile are signed out and sent to sign-in
 * (social login is sign-in only — use email sign-up or an invite first).
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

  if (profileError || !profile) {
    await supabase.auth.signOut();
    const redirect = new URL("/sign-in", url.origin);
    redirect.searchParams.set("auth_error", "no_account");
    return NextResponse.redirect(redirect);
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

  const response = NextResponse.redirect(new URL(next, url.origin));
  if (sessionId) {
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
  }
  return response;
}
