import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { passwordChangeSchema } from "@/lib/settings/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/settings/security/password — change the calling user's password.
 *
 * Flow:
 *   1. Auth via getCurrentUser().
 *   2. Verify current password by calling signInWithPassword on a
 *      dedicated anon client (does NOT mutate the user's existing
 *      cookies — important so a wrong-password attempt doesn't sign the
 *      user out).
 *   3. If verified, call updateUser({ password }) on the cookie-bound
 *      server client — this rotates the password and invalidates the
 *      Supabase refresh token.
 *   4. Update users.last_password_change_at + audit_log.
 */
export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = passwordChangeSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.json(
      { error: "config_missing" },
      { status: 500 },
    );
  }

  // Get the email of the current user from the cookie-bound client.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.email) {
    return NextResponse.json(
      { error: "no_email", message: "No email on file for this account." },
      { status: 400 },
    );
  }

  // Step 1: verify the current password using a throwaway client that
  // does NOT touch the user's session cookies.
  const verifier = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: authUser.email,
    password: parsed.current_password,
  });

  if (verifyError) {
    return NextResponse.json(
      {
        error: "wrong_current",
        message: "Current password is incorrect.",
      },
      { status: 400 },
    );
  }

  // Step 2: rotate the password on the real (cookie-bound) client.
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.new_password,
  });
  if (updateError) {
    return NextResponse.json(
      { error: "update_failed", message: updateError.message },
      { status: 500 },
    );
  }

  // Step 3: stamp users.last_password_change_at + audit.
  await supabase
    .from("users")
    .update({ last_password_change_at: new Date().toISOString() })
    .eq("id", user.id);

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "security.password.change",
    entity_type: "user",
    entity_id: user.id,
    diff: null,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
