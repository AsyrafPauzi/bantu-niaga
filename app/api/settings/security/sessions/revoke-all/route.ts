import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCurrentSessionId,
  revokeOtherSessions,
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
  const currentSessionId = await getCurrentSessionId();

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

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "security.sessions.revoke_all",
    entity_type: "user",
    entity_id: user.id,
    diff: { kept_session_id: currentSessionId },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
