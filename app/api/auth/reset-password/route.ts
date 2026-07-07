import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/auth/schemas";
import { enforceAuthRateLimit } from "@/lib/api/auth-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/reset-password — set a new password using the recovery
 * session that was established by /auth/callback.
 *
 * Supabase populates a "recovery" session in the auth cookie after the
 * user clicks the recovery email link. We update the password against
 * that session and stamp users.last_password_change_at.
 *
 * Returns 401 if there is no active session — the link expired or the
 * user navigated directly to /reset-password.
 */
export async function POST(request: Request) {
  const rl = enforceAuthRateLimit(
    request,
    "auth.reset-password",
    10,
    60 * 60 * 1000,
  );
  if (!rl.ok) return rl.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = resetPasswordSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "no_recovery_session",
        message:
          "Your reset link has expired. Request a new one from the sign-in page.",
      },
      { status: 401 },
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.new_password,
  });
  if (error) {
    return NextResponse.json(
      { error: "update_failed", message: error.message },
      { status: 400 },
    );
  }

  await supabase
    .from("users")
    .update({ last_password_change_at: new Date().toISOString() })
    .eq("id", user.id);

  // Best-effort audit entry. If the users row has no business yet (edge
  // case: profile_create_failed during signup), this insert is a no-op.
  const { data: profile } = await supabase
    .from("users")
    .select("business_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.business_id) {
    await supabase.from("audit_log").insert({
      business_id: profile.business_id,
      actor_user_id: user.id,
      action: "security.password.reset",
      entity_type: "user",
      entity_id: user.id,
      diff: null,
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
