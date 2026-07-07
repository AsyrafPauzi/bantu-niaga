import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensureCurrentSession,
  registerNewSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/sessions";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/security/sessions/register
 * Records this browser as an active session (sign-in or first app visit).
 */
export async function POST() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const h = await headers();
  const meta = {
    userAgent: h.get("user-agent"),
    forwardedFor: h.get("x-forwarded-for"),
    realIp: h.get("x-real-ip"),
  };

  const supabase = await createSupabaseServerClient();

  try {
    const sessionId = await registerNewSession(supabase, user.id, meta);
    const res = NextResponse.json({ session_id: sessionId }, { status: 201 });
    res.cookies.set(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
    return res;
  } catch (e) {
    return NextResponse.json(
      {
        error: "register_failed",
        message: e instanceof Error ? e.message : "Could not register session",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/settings/security/sessions/register
 * Ensures a session row exists for the current browser (touch or create).
 */
export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const h = await headers();
  const meta = {
    userAgent: h.get("user-agent"),
    forwardedFor: h.get("x-forwarded-for"),
    realIp: h.get("x-real-ip"),
  };

  const supabase = await createSupabaseServerClient();

  try {
    const { sessionId, created } = await ensureCurrentSession(
      supabase,
      user.id,
      meta,
    );
    const res = NextResponse.json(
      { session_id: sessionId, created },
      { status: created ? 201 : 200 },
    );
    if (created) {
      res.cookies.set(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
    }
    return res;
  } catch (e) {
    return NextResponse.json(
      {
        error: "ensure_failed",
        message: e instanceof Error ? e.message : "Could not ensure session",
      },
      { status: 500 },
    );
  }
}
