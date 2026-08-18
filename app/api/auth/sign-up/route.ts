import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { signUpSchema } from "@/lib/auth/schemas";
import { authCallbackUrl } from "@/lib/auth/site-url";
import { isEmailVerificationRequired } from "@/lib/auth/email-verification-policy";
import { sendSignupVerificationEmail } from "@/lib/auth/send-verification-email";
import { enforceAuthRateLimit } from "@/lib/api/auth-rate-limit";
import { isStandaloneDeployment } from "@/lib/platform/deployment";
import { canAcceptPublicSignup } from "@/lib/platform/standalone-bootstrap";
import { provisionOwnerBusiness } from "@/lib/auth/provision-owner-business";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/sign-up — open self-serve registration.
 *
 * Pipeline:
 *   1. Validate input with Zod.
 *   2. Create the auth user (auto-confirmed when verification is bypassed).
 *   3. Provision business + owner profile via shared helper.
 *
 * On any failure after step 2 we DELETE the auth user to keep state
 * consistent — otherwise the user could sign in but never reach /home
 * (no profile = UnauthorizedError on every request).
 *
 * Client follow-up: verification flow when AUTH_REQUIRE_EMAIL_VERIFICATION=true,
 * otherwise auto sign-in on the sign-up page.
 */
export async function POST(request: Request) {
  const rl = enforceAuthRateLimit(request, "auth.sign-up", 5, 60 * 60 * 1000);
  if (!rl.ok) return rl.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = signUpSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const admin = createServiceRoleClient();
  const verificationRequired = isEmailVerificationRequired();

  if (isStandaloneDeployment()) {
    const allowed = await canAcceptPublicSignup(admin);
    if (!allowed) {
      return NextResponse.json(
        {
          error: "signup_disabled",
          message:
            "Self-serve sign-up is disabled on this installation. Sign in with your existing account.",
        },
        { status: 403 },
      );
    }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: !verificationRequired,
    user_metadata: {
      business_name: parsed.business_name,
      signup_source: "self_serve",
    },
  });

  if (createError || !created.user) {
    const msg = createError?.message ?? "Could not create account.";
    return NextResponse.json(
      {
        error: "create_failed",
        message: msg.toLowerCase().includes("registered")
          ? "An account with that email already exists. Try signing in instead."
          : msg,
      },
      { status: 400 },
    );
  }

  const authUser = created.user;

  async function rollback() {
    try {
      await admin.auth.admin.deleteUser(authUser.id);
    } catch {
      // Best-effort. If we cannot delete, the next signup attempt with
      // the same email will fail with "registered" and the user will
      // need to use forgot-password to recover.
    }
  }

  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent") || null;

  const provisioned = await provisionOwnerBusiness(admin, {
    authUserId: authUser.id,
    email: parsed.email,
    businessName: parsed.business_name,
    stateCode: parsed.state_code,
    signupPath: parsed.signup_path,
    onboardingQuiz: parsed.onboarding_quiz,
    sourceIp,
    userAgent,
    signupSource: "self_serve",
  });

  if (!provisioned.ok) {
    await rollback();
    return NextResponse.json(
      { error: provisioned.error, message: provisioned.message },
      { status: provisioned.status },
    );
  }

  if (!verificationRequired) {
    return NextResponse.json(
      {
        ok: true,
        verification_required: false,
        business_id: provisioned.businessId,
        idcompany: provisioned.idcompany,
        email: parsed.email,
      },
      { status: 201 },
    );
  }

  const redirectTo = authCallbackUrl(
    "/onboarding/recommendation",
    request.headers.get("origin"),
  );

  let devVerificationLink: string | null = null;
  try {
    const verification = await sendSignupVerificationEmail({
      email: parsed.email,
      password: parsed.password,
      redirectTo,
      admin,
    });
    devVerificationLink = verification.devLink;
  } catch (emailError) {
    await admin.from("user_consents").delete().eq("user_id", authUser.id);
    await admin.from("users").delete().eq("id", authUser.id);
    await admin.from("businesses").delete().eq("id", provisioned.businessId);
    await rollback();
    return NextResponse.json(
      {
        error: "verification_email_failed",
        message:
          emailError instanceof Error
            ? emailError.message
            : "Could not send verification email. Try again shortly.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      verification_required: true,
      business_id: provisioned.businessId,
      idcompany: provisioned.idcompany,
      email: parsed.email,
      dev_verification_link: devVerificationLink,
    },
    { status: 201 },
  );
}
