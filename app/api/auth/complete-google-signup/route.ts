import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { enforceAuthRateLimit } from "@/lib/api/auth-rate-limit";
import { completeGoogleSignupSchema } from "@/lib/auth/schemas";
import { provisionOwnerBusiness } from "@/lib/auth/provision-owner-business";
import { isStandaloneDeployment } from "@/lib/platform/deployment";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rl = enforceAuthRateLimit(
    request,
    "auth.complete-google-signup",
    5,
    60 * 60 * 1000,
  );
  if (!rl.ok) return rl.response;

  if (isStandaloneDeployment()) {
    return NextResponse.json(
      {
        error: "signup_disabled",
        message:
          "Self-serve sign-up is disabled on this installation. Sign in with your existing account.",
      },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = completeGoogleSignupSchema.parse(body);
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
  const email = user.email.trim().toLowerCase();

  const { data: existing, error: existingError } = await admin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ ok: true, already_complete: true });
  }

  const { data: emailOwner } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (emailOwner && emailOwner.id !== user.id) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  const result = await provisionOwnerBusiness(admin, {
    authUserId: user.id,
    email,
    businessName: parsed.business_name,
    stateCode: parsed.state_code,
    signupPath: parsed.signup_path,
    onboardingQuiz: parsed.onboarding_quiz,
    sourceIp,
    userAgent: request.headers.get("user-agent"),
    signupSource: "google",
    preferredLocale: parsed.preferred_locale,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const existingMeta =
    user.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata
      : {};
  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...existingMeta,
      preferred_locale: parsed.preferred_locale,
      signup_source: "google",
    },
  });
  if (metaError) {
    logger.warn("auth.complete_google.metadata_locale_failed", {
      userId: user.id,
    });
  }

  return NextResponse.json({ ok: true });
}
