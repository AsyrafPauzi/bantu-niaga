import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { forgotPasswordSchema } from "@/lib/auth/schemas";
import { authCallbackUrl } from "@/lib/auth/site-url";
import { isEmailVerificationRequired } from "@/lib/auth/email-verification-policy";
import { sendSignupVerificationEmail } from "@/lib/auth/send-verification-email";
import { enforceAuthRateLimit } from "@/lib/api/auth-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/resend-verification — resend the sign-up confirmation email.
 *
 * Always returns 200 (even when the email isn't on file) to avoid enumeration.
 */
export async function POST(request: Request) {
  const rl = enforceAuthRateLimit(
    request,
    "auth.resend-verification",
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
    "/onboarding/recommendation",
    request.headers.get("origin"),
  );

  if (!isEmailVerificationRequired()) {
    return NextResponse.json(
      {
        ok: true,
        message: "Email verification is not required on this environment.",
      },
      { status: 200 },
    );
  }

  let devLink: string | null = null;
  try {
    const admin = createServiceRoleClient();
    const result = await sendSignupVerificationEmail({
      email: parsed.email,
      password: null,
      redirectTo,
      admin,
    });
    devLink = result.devLink;
  } catch {
    // Privacy-safe no-op when the address is unknown or already verified.
  }

  return NextResponse.json(
    {
      ok: true,
      message:
        "If that email matches an unverified account, we've sent a new link.",
      dev_verification_link: devLink,
    },
    { status: 200 },
  );
}
