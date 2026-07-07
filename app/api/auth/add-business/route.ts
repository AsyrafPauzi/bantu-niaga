import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { ensureMembership, switchActiveBusiness } from "@/lib/auth/memberships";
import { addBusinessSchema } from "@/lib/auth/schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/add-business — create another company under the same login.
 * Requires password re-entry for security.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    parsed = addBusinessSchema.parse(body);
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
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) {
    return NextResponse.json({ error: "no_email" }, { status: 400 });
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: authUser.email,
    password: parsed.password,
  });
  if (verifyError) {
    return NextResponse.json(
      { error: "invalid_password", message: "Password is incorrect." },
      { status: 401 },
    );
  }

  const admin = createServiceRoleClient();
  const idcompany = slugifyBusiness(parsed.business_name) + "-" + randomShort();

  const { data: businessRow, error: businessError } = await admin
    .from("businesses")
    .insert({
      idcompany,
      name: parsed.business_name,
      state_code: parsed.state_code ?? null,
      tier: "starter",
      subscription_status: "trial",
      subscription_renewal_at: new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      brand_primary_hex: "#5B8C5A",
      brand_accent_hex: "#F4A340",
      credit_balance: 50,
    })
    .select("id, idcompany, name")
    .single();

  if (businessError || !businessRow) {
    return NextResponse.json(
      {
        error: "business_create_failed",
        message: businessError?.message ?? "Could not create business",
      },
      { status: 500 },
    );
  }

  await ensureMembership(user.id, businessRow.id, "owner", {
    email: authUser.email,
    display_name: parsed.business_name,
  });

  const switched = await switchActiveBusiness(user.id, businessRow.id);
  if (!switched) {
    return NextResponse.json({ error: "switch_failed" }, { status: 500 });
  }

  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent") || null;
  const policyVersion = process.env.PRIVACY_POLICY_VERSION || "2026-06-14";

  await Promise.all([
    admin.from("audit_log").insert({
      business_id: businessRow.id,
      actor_user_id: user.id,
      action: "auth.add_business",
      entity_type: "business",
      entity_id: businessRow.id,
      diff: { name: parsed.business_name, trial_days: 14 },
    }),
    admin.from("credit_ledger").insert({
      business_id: businessRow.id,
      delta: 50,
      reason: "welcome_bonus",
      actor_user_id: user.id,
    }),
    admin.from("user_consents").insert([
      {
        business_id: businessRow.id,
        user_id: user.id,
        kind: "terms_of_service",
        granted: true,
        policy_version: policyVersion,
        granted_at: new Date().toISOString(),
        source_ip: sourceIp,
        user_agent: userAgent,
      },
      {
        business_id: businessRow.id,
        user_id: user.id,
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
      name: businessRow.name,
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
