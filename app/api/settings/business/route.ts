import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BUSINESS_SELECT } from "@/lib/settings/business";
import { businessUpdateSchema } from "@/lib/settings/schemas";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/business — full settings payload for the calling
 * user's business. Read-only — all roles can fetch.
 */
export async function GET() {
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
  const { data, error } = await supabase
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("id", user.businessId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "load_failed", message: error?.message ?? "Business not found" },
      { status: 500 },
    );
  }

  return NextResponse.json({ business: data }, { status: 200 });
}

/**
 * PATCH /api/settings/business — owner-only update of brand fields,
 * receipt header, and email identity.
 */
export async function PATCH(request: Request) {
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

  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "forbidden", reason: "Only the business owner can change settings." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = businessUpdateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  if (Object.keys(parsed).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("businesses")
    .update(parsed)
    .eq("id", user.businessId)
    .select(BUSINESS_SELECT)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "update_failed", message: error?.message ?? "no row" },
      { status: 500 },
    );
  }

  // Fire-and-forget audit log.
  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "settings.business.update",
    entity_type: "business",
    entity_id: user.businessId,
    diff: parsed,
  });

  return NextResponse.json({ business: data }, { status: 200 });
}
