import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tierChangeSchema } from "@/lib/settings/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/subscription/change — owner-only tier switch.
 *
 * For the demo build we apply the change instantly via the
 * settings_change_tier RPC. The RPC writes an audit_log row and updates
 * businesses.tier + subscription_renewal_at in one transaction.
 */
export async function POST(request: Request) {
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
      { error: "forbidden", reason: "Only the owner can change the plan." },
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
    parsed = tierChangeSchema.parse(body);
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
  const { error: rpcError } = await supabase.rpc("settings_change_tier", {
    p_business_id: user.businessId,
    p_tier: parsed.tier,
    p_user_id: user.id,
  });

  if (rpcError) {
    return NextResponse.json(
      { error: "change_failed", message: rpcError.message },
      { status: 500 },
    );
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("tier, subscription_status, subscription_renewal_at")
    .eq("id", user.businessId)
    .maybeSingle();

  return NextResponse.json(
    {
      tier: business?.tier ?? parsed.tier,
      subscription_status: business?.subscription_status ?? "active",
      subscription_renewal_at: business?.subscription_renewal_at,
    },
    { status: 200 },
  );
}
