import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { twoFaDisableSchema } from "@/lib/settings/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/settings/security/2fa/disable — unenroll a TOTP factor.
 *
 * Body: { factor_id }
 *
 * Audit-logged.
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
    parsed = twoFaDisableSchema.parse(body);
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
  const { error } = await supabase.auth.mfa.unenroll({
    factorId: parsed.factor_id,
  });

  if (error) {
    return NextResponse.json(
      { error: "disable_failed", message: error.message },
      { status: 500 },
    );
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "security.2fa.disabled",
    entity_type: "user",
    entity_id: user.id,
    diff: { factor_id: parsed.factor_id },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
