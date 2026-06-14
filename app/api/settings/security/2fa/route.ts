import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/settings/security/2fa — list enrolled MFA factors for the
 * calling user.
 */
export async function GET() {
  try {
    await getCurrentUser();
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
  const { data, error } = await supabase.auth.mfa.listFactors();

  if (error) {
    return NextResponse.json(
      { error: "list_failed", message: error.message },
      { status: 500 },
    );
  }

  const totp = (data?.totp ?? []).map((f) => ({
    id: f.id,
    name: f.friendly_name ?? "Authenticator",
    status: f.status,
    created_at: f.created_at,
  }));

  return NextResponse.json(
    { totp, has_verified: totp.some((f) => f.status === "verified") },
    { status: 200 },
  );
}
