import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/settings/security/sessions/revoke-all — sign out everywhere
 * EXCEPT the current device.
 *
 * Uses Supabase's `signOut({ scope: 'others' })` which invalidates all
 * refresh tokens for the user other than the current one. The browser
 * will then need to sign back in on every other device.
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
  const { error } = await supabase.auth.signOut({ scope: "others" });

  if (error) {
    return NextResponse.json(
      { error: "revoke_failed", message: error.message },
      { status: 500 },
    );
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "security.sessions.revoke_all",
    entity_type: "user",
    entity_id: user.id,
    diff: null,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
