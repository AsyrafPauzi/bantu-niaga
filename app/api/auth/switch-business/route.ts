import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { switchActiveBusiness } from "@/lib/auth/memberships";
import { switchBusinessSchema } from "@/lib/auth/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/switch-business — change active company without signing out.
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
    parsed = switchBusinessSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  if (parsed.business_id === user.businessId) {
    return NextResponse.json({ ok: true, already_active: true }, { status: 200 });
  }

  const switched = await switchActiveBusiness(user.id, parsed.business_id);
  if (!switched) {
    return NextResponse.json(
      { error: "not_a_member", message: "You do not have access to that company." },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  await supabase.from("audit_log").insert({
    business_id: switched.businessId,
    actor_user_id: user.id,
    action: "auth.switch_business",
    entity_type: "business",
    entity_id: switched.businessId,
    diff: { from_business_id: user.businessId },
  });

  return NextResponse.json(
    {
      ok: true,
      business_id: switched.businessId,
      role: switched.role,
    },
    { status: 200 },
  );
}
