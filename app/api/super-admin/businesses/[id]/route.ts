import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z
  .object({
    action: z.enum(["set_status", "set_tier"]),
    status: z.enum(["active", "past_due", "cancelled", "trial"]).optional(),
    tier: z.enum(["starter", "micro", "sme", "enterprise"]).optional(),
    reason: z.string().max(500).optional(),
  })
  .strict();

/**
 * PATCH /api/super-admin/businesses/[id]
 *
 *   - action=set_status   → flips subscription_status (e.g. suspend/restore)
 *   - action=set_tier     → forces a plan change (no proration, used for
 *                           manual upgrades like comped enterprise trials)
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requirePlatformAdmin();
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed: z.infer<typeof patchSchema>;
  try {
    parsed = patchSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const svc = createServiceRoleClient();
  const { data: biz } = await svc
    .from("businesses")
    .select("id, name, tier, subscription_status")
    .eq("id", id)
    .maybeSingle();
  if (!biz) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const b = biz as {
    id: string;
    name: string;
    tier: string;
    subscription_status: string;
  };

  if (parsed.action === "set_status") {
    if (!parsed.status) {
      return NextResponse.json(
        { error: "validation_failed", message: "status is required" },
        { status: 400 },
      );
    }
    const { error } = await svc.rpc("super_admin_set_business_status", {
      p_business_id: id,
      p_status: parsed.status,
      p_reason: parsed.reason ?? null,
    });
    if (error) {
      return NextResponse.json(
        { error: "update_failed", message: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, status: parsed.status });
  }

  if (parsed.action === "set_tier") {
    if (!parsed.tier) {
      return NextResponse.json(
        { error: "validation_failed", message: "tier is required" },
        { status: 400 },
      );
    }
    const { error } = await svc
      .from("businesses")
      .update({ tier: parsed.tier })
      .eq("id", id);
    if (error) {
      return NextResponse.json(
        { error: "update_failed", message: error.message },
        { status: 500 },
      );
    }
    await svc.from("super_admin_audit").insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: "business.set_tier",
      target_type: "business",
      target_id: id,
      target_business_id: id,
      diff: { from: b.tier, to: parsed.tier, reason: parsed.reason },
    });
    return NextResponse.json({ ok: true, tier: parsed.tier });
  }

  return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
}
