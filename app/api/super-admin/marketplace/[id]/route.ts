import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z
  .object({
    status: z.enum(["live", "draft", "disabled"]),
  })
  .strict();

/**
 * PATCH /api/super-admin/marketplace/[id]
 *
 * Toggle the live/draft/disabled status on a marketplace add-on.
 * Platform-admin only; the underlying RPC re-checks.
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

  let parsed: { status: "live" | "draft" | "disabled" };
  try {
    parsed = schema.parse(body);
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
  const { data: addon } = await svc
    .from("marketplace_addons")
    .select("id, slug, status")
    .eq("id", id)
    .maybeSingle();
  if (!addon) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const previous = (addon as { status: string }).status;
  const { error } = await svc
    .from("marketplace_addons")
    .update({ status: parsed.status })
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
    action: "marketplace.set_status",
    target_type: "addon",
    target_id: (addon as { slug: string }).slug,
    diff: { from: previous, to: parsed.status },
  });

  return NextResponse.json({ ok: true, status: parsed.status });
}
