import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/lib/auth/schemas";
import { authCallbackUrl } from "@/lib/auth/site-url";
import { enforceAuthRateLimit } from "@/lib/api/auth-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/forgot-password — kick off a password-reset email.
 *
 * Always returns 200 (even when the email isn't on file) to avoid
 * leaking user-enumeration. Supabase Auth's resetPasswordForEmail
 * silently no-ops for unknown addresses, so the privacy guarantee is
 * preserved end-to-end.
 *
 * The email contains a recovery link that lands on
 * `${appUrl}/auth/callback?type=recovery&...` which then forwards the
 * user to /reset-password with the session ready.
 */
export async function POST(request: Request) {
  const rl = enforceAuthRateLimit(
    request,
    "auth.forgot-password",
    5,
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
    parsed = forgotPasswordSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const redirectTo = authCallbackUrl(
    "/reset-password",
    request.headers.get("origin"),
  );

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.email, {
    redirectTo,
  });

  // Always 200 — no leak about whether the email exists.
  return NextResponse.json(
    {
      ok: true,
      message:
        "If that email matches an account, we've sent a reset link. Check your inbox in the next minute.",
    },
    { status: 200 },
  );
}
