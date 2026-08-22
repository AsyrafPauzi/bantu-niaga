import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { headers } from "next/headers";
import {
  registerNewSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/sessions";
import { resolveGoogleCallbackTarget } from "@/lib/auth/google-callback";
import { sanitizeAuthNextPath } from "@/lib/auth/social-login";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

/**
 * POST /api/auth/callback/establish
 *
 * Accepts hash-fragment tokens from invite/magiclink redirects, writes the
 * Supabase session cookies on the server, then returns where to send the user.
 * Used by a plain public script so /auth/callback does not depend on React
 * hydration (CSP blocked client bundles on this route previously).
 */
export async function POST(request: Request) {
  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.json(
      { error: "not_configured", message: "Auth is not configured." },
      { status: 503 },
    );
  }

  let accessToken = "";
  let refreshToken = "";
  let nextPath = "/home";
  let hashType: string | null = null;

  try {
    const body = (await request.json()) as {
      access_token?: unknown;
      refresh_token?: unknown;
      next?: unknown;
      type?: unknown;
    };
    accessToken =
      typeof body.access_token === "string" ? body.access_token.trim() : "";
    refreshToken =
      typeof body.refresh_token === "string" ? body.refresh_token.trim() : "";
    nextPath = sanitizeAuthNextPath(
      typeof body.next === "string" ? body.next : null,
    );
    hashType = typeof body.type === "string" ? body.type : null;
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Invalid request body." },
      { status: 400 },
    );
  }

  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      {
        error: "missing_tokens",
        message: "Invite link is missing tokens. Ask for a fresh invite.",
        redirect: "/sign-in?auth_error=missing_code",
      },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { data: sessionData, error: sessionError } =
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

  if (sessionError || !sessionData.user) {
    return NextResponse.json(
      {
        error: "session_failed",
        message:
          sessionError?.message ??
          "Invite link expired or invalid. Ask your owner for a new one.",
        redirect: "/sign-in?auth_error=missing_code",
      },
      { status: 401 },
    );
  }

  const user = sessionData.user;
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

  if (hashType === "invite" || hashType === "magiclink") {
    if (nextPath === "/home") nextPath = "/accept-invite";
  } else if (hashType === "recovery") {
    nextPath = "/reset-password";
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
    // best-effort
  }

  const response = NextResponse.json({ redirect: target.nextPath });
  if (sessionId) {
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
  }
  return response;
}
