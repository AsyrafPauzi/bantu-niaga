import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { signUpSchema } from "@/lib/auth/schemas";
import { ensureMembership } from "@/lib/auth/memberships";
import { enforceAuthRateLimit } from "@/lib/api/auth-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/sign-up — open self-serve registration.
 *
 * Pipeline (all in this single endpoint so partial failures roll back):
 *   1. Validate input with Zod.
 *   2. Create the auth user via the admin API with email_confirm:true
 *      (auto-confirmed — production should send a magic-link instead).
 *   3. Create the business row (Starter tier, 30-day renewal window).
 *   4. Create the public.users profile row (role='owner').
 *   5. Seed a single 'starter' invoice marker so the billing page has
 *      something to show on first visit.
 *
 * On any failure after step 2 we DELETE the auth user to keep state
 * consistent — otherwise the user could sign in but never reach /home
 * (no profile = UnauthorizedError on every request).
 *
 * Client follow-up: after this returns 201, the sign-up page calls
 * supabase.auth.signInWithPassword({email, password}) to set the
 * session cookie, then router.replace('/home').
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

  // Step 1: auth user
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
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

  // Helper — cleanup on rollback.
  async function rollback() {
    try {
      await admin.auth.admin.deleteUser(authUser.id);
    } catch {
      // Best-effort. If we cannot delete, the next signup attempt with
      // the same email will fail with "registered" and the user will
      // need to use forgot-password to recover.
    }
  }

  // Step 2: business + users + first invoice (single transaction via RPC)
  const idcompany = slugifyBusiness(parsed.business_name) + "-" + randomShort();
  const isFreePath = parsed.signup_path === "free";

  const { data: businessRow, error: businessError } = await admin
    .from("businesses")
    .insert({
      idcompany,
      name: parsed.business_name,
      state_code: parsed.state_code ?? null,
      tier: isFreePath ? "starter" : "micro",
      subscription_status: isFreePath ? "active" : "trial",
      subscription_renewal_at: isFreePath
        ? null
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      brand_primary_hex: "#5B8C5A",
      brand_accent_hex: "#F4A340",
      credit_balance: isFreePath ? 0 : 50,
    })
    .select("id, idcompany, name")
    .single();

  if (businessError || !businessRow) {
    await rollback();
    return NextResponse.json(
      {
        error: "business_create_failed",
        message: businessError?.message ?? "Could not create business",
      },
      { status: 500 },
    );
  }

  const { error: profileError } = await admin.from("users").insert({
    id: authUser.id,
    business_id: businessRow.id,
    role: "owner",
    display_name: parsed.business_name,
    email: parsed.email,
    last_password_change_at: new Date().toISOString(),
  });

  if (profileError) {
    await admin.from("businesses").delete().eq("id", businessRow.id);
    await rollback();
    return NextResponse.json(
      { error: "profile_create_failed", message: profileError.message },
      { status: 500 },
    );
  }

  try {
    await ensureMembership(authUser.id, businessRow.id, "owner", {
      email: parsed.email,
      display_name: parsed.business_name,
    });
  } catch (membershipError) {
    await admin.from("users").delete().eq("id", authUser.id);
    await admin.from("businesses").delete().eq("id", businessRow.id);
    await rollback();
    return NextResponse.json(
      {
        error: "membership_create_failed",
        message:
          membershipError instanceof Error
            ? membershipError.message
            : "Could not link business membership",
      },
      { status: 500 },
    );
  }

  // Step 3: seed a welcome audit entry
  // explicit PDPA-aligned consent rows for the two required consents.
  // The remaining (opt-in) consents default to false until the user toggles
  // them in /settings/privacy.
  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent") || null;
  const policyVersion = process.env.PRIVACY_POLICY_VERSION || "2026-06-14";

  await Promise.all([
    admin.from("audit_log").insert({
      business_id: businessRow.id,
      actor_user_id: authUser.id,
      action: "auth.sign_up",
      entity_type: "business",
      entity_id: businessRow.id,
      diff: {
        tier: isFreePath ? "starter" : "micro",
        signup_path: parsed.signup_path,
        trial_days: isFreePath ? 0 : 14,
        policy_version: policyVersion,
      },
    }),
    ...(isFreePath
      ? []
      : [
          admin.from("credit_ledger").insert({
            business_id: businessRow.id,
            delta: 50,
            reason: "welcome_bonus",
            actor_user_id: authUser.id,
          }),
        ]),
    admin.from("user_consents").insert([
      {
        business_id: businessRow.id,
        user_id: authUser.id,
        kind: "terms_of_service",
        granted: true,
        policy_version: policyVersion,
        granted_at: new Date().toISOString(),
        source_ip: sourceIp,
        user_agent: userAgent,
      },
      {
        business_id: businessRow.id,
        user_id: authUser.id,
        kind: "privacy_notice",
        granted: true,
        policy_version: policyVersion,
        granted_at: new Date().toISOString(),
        source_ip: sourceIp,
        user_agent: userAgent,
      },
    ]),
  ]);

  return NextResponse.json(
    {
      ok: true,
      business_id: businessRow.id,
      idcompany: businessRow.idcompany,
      email: parsed.email,
    },
    { status: 201 },
  );
}

function slugifyBusiness(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "business";
}

function randomShort(): string {
  return Math.random().toString(36).slice(2, 8);
}
