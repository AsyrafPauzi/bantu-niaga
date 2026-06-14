import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { twoFaVerifySchema } from "@/lib/settings/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/settings/security/2fa/verify — confirm a TOTP factor.
 *
 * Body: { factor_id, challenge_id, code }
 *
 * On success the factor moves to status='verified' and the user must
 * provide a code on every subsequent sign-in.
 *
 * If `challenge_id` is omitted, we challenge first then verify in the
 * same request — convenient for the enrol page.
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
    parsed = twoFaVerifySchema.partial({ challenge_id: true }).parse(body);
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

  let challengeId = parsed.challenge_id;
  if (!challengeId) {
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: parsed.factor_id,
    });
    if (chErr || !ch) {
      return NextResponse.json(
        { error: "challenge_failed", message: chErr?.message },
        { status: 500 },
      );
    }
    challengeId = ch.id;
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId: parsed.factor_id,
    challengeId,
    code: parsed.code,
  });

  if (error) {
    return NextResponse.json(
      {
        error: "verify_failed",
        message:
          "Code didn't match. Make sure your authenticator clock is in sync.",
      },
      { status: 400 },
    );
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "security.2fa.enabled",
    entity_type: "user",
    entity_id: user.id,
    diff: { factor_id: parsed.factor_id },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
