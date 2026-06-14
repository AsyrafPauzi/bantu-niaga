import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/settings/security/2fa/enroll — start a TOTP factor enrolment.
 *
 * Returns:
 *   - factor_id
 *   - qr_code (data URL of the QR for authenticator apps)
 *   - secret (base32 — for copy/paste fallback)
 *
 * The factor is `unverified` until the user POSTs to /verify with a 6-digit
 * code from their authenticator app.
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

  // Clean up any unverified factors first — Supabase returns 422 if there's
  // already an enrolled factor with the same name. Iterate listed factors
  // and unenroll any in 'unverified' state to keep the flow idempotent.
  const { data: list } = await supabase.auth.mfa.listFactors();
  if (list?.all) {
    for (const f of list.all) {
      if (f.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Bantu Niaga · ${new Date().toISOString().slice(0, 10)}`,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: "enroll_failed", message: error?.message ?? "no factor" },
      { status: 500 },
    );
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "security.2fa.enroll_start",
    entity_type: "user",
    entity_id: user.id,
    diff: { factor_id: data.id },
  });

  return NextResponse.json(
    {
      factor_id: data.id,
      qr_code: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    },
    { status: 200 },
  );
}
