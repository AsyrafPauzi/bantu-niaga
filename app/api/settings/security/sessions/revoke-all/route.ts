import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensureCurrentSession,
  getCurrentSessionId,
  listActiveSessions,
  revokeOtherSessions,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/settings/security/sessions/revoke-all — sign out everywhere
 * EXCEPT the current device.
 */
export async function POST() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const h = await headers();
  const meta = {
    userAgent: h.get("user-agent"),
    forwardedFor: h.get("x-forwarded-for"),
    realIp: h.get("x-real-ip"),
  };

  let currentSessionId = await getCurrentSessionId();
  try {
    const ensured = await ensureCurrentSession(supabase, user.id, meta);
    currentSessionId = ensured.sessionId;
  } catch {
    // Continue — revoke still clears stale rows when possible.
  }

  const beforeCount = (await listActiveSessions(supabase, user.id)).length;

  const { error } = await supabase.auth.signOut({ scope: "others" });

  if (error) {
    return NextResponse.json(
      { error: "revoke_failed", message: error.message },
      { status: 500 },
    );
  }

  try {
    await revokeOtherSessions(supabase, user.id, currentSessionId);
  } catch (e) {
    return NextResponse.json(
      {
        error: "revoke_failed",
        message: e instanceof Error ? e.message : "Could not revoke sessions",
      },
      { status: 500 },
    );
  }

  const afterCount = (await listActiveSessions(supabase, user.id)).length;
  const revokedCount = Math.max(0, beforeCount - afterCount);

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "security.sessions.revoke_all",
    entity_type: "user",
    entity_id: user.id,
    diff: { kept_session_id: currentSessionId, revoked_count: revokedCount },
  });

  const res = NextResponse.json(
    { ok: true, revoked_count: revokedCount, kept_session_id: currentSessionId },
    { status: 200 },
  );

  if (currentSessionId) {
    res.cookies.set(
      SESSION_COOKIE_NAME,
      currentSessionId,
      sessionCookieOptions(),
    );
  }

  return res;
}
