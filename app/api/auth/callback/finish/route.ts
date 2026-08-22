import { NextResponse } from "next/server";
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
 * POST /api/auth/callback/finish — after the browser establishes a session
 * (PKCE code exchange or hash tokens), decide where to send the user.
 *
 * Accepts an optional `access_token` (body or Bearer) so invite hash flows
 * still work if cookies are not visible to the server on the same tick.
 */
export async function POST(request: Request) {
  let nextPath = "/home";
  let accessToken: string | null = null;
  try {
    const body = (await request.json()) as {
      next?: unknown;
      access_token?: unknown;
    };
    nextPath = sanitizeAuthNextPath(
      typeof body.next === "string" ? body.next : null,
    );
    if (typeof body.access_token === "string" && body.access_token.length > 20) {
      accessToken = body.access_token;
    }
  } catch {
    nextPath = "/home";
  }

  const authHeader = request.headers.get("authorization");
  if (
    !accessToken &&
    authHeader?.toLowerCase().startsWith("bearer ")
  ) {
    const token = authHeader.slice(7).trim();
    if (token.length > 20) accessToken = token;
  }

  const supabase = await createSupabaseServerClient();
  let user = (await supabase.auth.getUser()).data.user ?? null;

  if (!user && accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error) {
      user = data.user ?? null;
    }
  }

  if (!user) {
    return NextResponse.json(
      {
        error: "missing_session",
        message: "Session not ready. Open the invite link again.",
        redirect: "/sign-in?auth_error=missing_code",
      },
      { status: 401 },
    );
  }

  const admin = createServiceRoleClient();
  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      {
        error: "profile_lookup_failed",
        message: "Could not load your account.",
        redirect: "/sign-in?auth_error=missing_code",
      },
      { status: 500 },
    );
  }

  let emailOwnerId: string | null = null;
  if (!profile?.id && user.email) {
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
    nextPath,
  });

  if (target.kind === "email_taken") {
    await supabase.auth.signOut();
    return NextResponse.json({
      redirect: "/sign-in?auth_error=email_taken",
    });
  }

  if (target.kind === "complete") {
    return NextResponse.json({ redirect: "/sign-up/complete" });
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

  const response = NextResponse.json({ redirect: target.nextPath });
  if (sessionId) {
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
  }
  return response;
}
