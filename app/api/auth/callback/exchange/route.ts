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
 * GET /api/auth/callback/exchange?code=&next=
 * PKCE code exchange for Google / email links that return ?code=.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextPath = sanitizeAuthNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL("/sign-in?auth_error=missing_code", url.origin),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(
      new URL(
        `/sign-in?auth_error=${encodeURIComponent(exchangeError.message)}`,
        url.origin,
      ),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/sign-in?auth_error=missing_code", url.origin),
    );
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  let emailOwnerId: string | null = null;
  if (!profile?.id && user.email) {
    const { data: emailOwner } = await admin
      .from("users")
      .select("id")
      .eq("email", user.email.trim().toLowerCase())
      .maybeSingle();
    emailOwnerId = emailOwner?.id ?? null;
  }

  const target = resolveGoogleCallbackTarget({
    authUserId: user.id,
    profileId: profile?.id ?? null,
    emailOwnerId,
    nextPath,
  });

  if (target.kind === "email_taken") {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/sign-in?auth_error=email_taken", url.origin),
    );
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
    // best-effort
  }

  const response = NextResponse.redirect(
    new URL(target.nextPath, url.origin),
  );
  if (sessionId) {
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
  }
  return response;
}
