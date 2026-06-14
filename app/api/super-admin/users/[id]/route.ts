import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z
  .object({
    action: z.enum(["suspend", "restore", "set_role", "reset_password"]),
    role: z
      .enum(["owner", "manager", "accountant", "hr_officer", "cashier", "staff"])
      .optional(),
  })
  .strict();

/**
 * PATCH /api/super-admin/users/[id]
 *
 * One endpoint for the cluster of small mutations a super-admin runs from
 * the user row menu:
 *
 *   - action=suspend          → flips `users.is_suspended`
 *   - action=restore          → un-suspends
 *   - action=set_role         → role swap via super_admin_set_user_role RPC
 *   - action=reset_password   → fires a Supabase Auth reset email
 *
 * Every action writes a super_admin_audit row.
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
  const { data: target } = await svc
    .from("users")
    .select("id, business_id, email, is_suspended, role")
    .eq("id", id)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const t = target as {
    id: string;
    business_id: string;
    email: string | null;
    is_suspended: boolean | null;
    role: string;
  };

  if (parsed.action === "suspend" || parsed.action === "restore") {
    const next = parsed.action === "suspend";
    const { error } = await svc
      .from("users")
      .update({ is_suspended: next })
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
      action: next ? "user.suspend" : "user.restore",
      target_type: "user",
      target_id: id,
      target_business_id: t.business_id,
      diff: { from: t.is_suspended ?? false, to: next },
    });
    return NextResponse.json({ ok: true, is_suspended: next });
  }

  if (parsed.action === "set_role") {
    if (!parsed.role) {
      return NextResponse.json(
        { error: "validation_failed", message: "role is required" },
        { status: 400 },
      );
    }
    const { error } = await svc
      .from("users")
      .update({ role: parsed.role })
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
      action: "user.set_role",
      target_type: "user",
      target_id: id,
      target_business_id: t.business_id,
      diff: { from: t.role, to: parsed.role },
    });
    return NextResponse.json({ ok: true, role: parsed.role });
  }

  if (parsed.action === "reset_password") {
    if (!t.email) {
      return NextResponse.json(
        { error: "no_email", message: "User has no email." },
        { status: 400 },
      );
    }
    try {
      // Supabase admin: send recovery email. Available on @supabase/supabase-js
      // service-role client via `auth.admin.generateLink`.
      await svc.auth.admin.generateLink({
        type: "recovery",
        email: t.email,
      });
    } catch (e) {
      return NextResponse.json(
        {
          error: "reset_failed",
          message: e instanceof Error ? e.message : "unknown",
        },
        { status: 500 },
      );
    }
    await svc.from("super_admin_audit").insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: "user.reset_password",
      target_type: "user",
      target_id: id,
      target_business_id: t.business_id,
      diff: { email: t.email },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
}

/**
 * DELETE /api/super-admin/users/[id]
 *
 * Permanently deletes a user (auth.users + public.users). Owner accounts
 * are protected — they must be demoted first.
 */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requirePlatformAdmin();
  const { id } = await ctx.params;
  const svc = createServiceRoleClient();

  const { data: target } = await svc
    .from("users")
    .select("id, business_id, email, role")
    .eq("id", id)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const t = target as {
    id: string;
    business_id: string;
    email: string | null;
    role: string;
  };
  if (t.role === "owner") {
    return NextResponse.json(
      {
        error: "owner_protected",
        message:
          "Demote the owner role to manager/staff before deleting this user.",
      },
      { status: 409 },
    );
  }

  // Remove the auth row first (cascade will clean up public.users via FK).
  try {
    await svc.auth.admin.deleteUser(id);
  } catch (e) {
    return NextResponse.json(
      {
        error: "delete_failed",
        message: e instanceof Error ? e.message : "unknown",
      },
      { status: 500 },
    );
  }

  // Belt + braces: also delete the profile row in case the cascade didn't
  // pick it up (e.g. when the auth row was already gone).
  await svc.from("users").delete().eq("id", id);

  await svc.from("super_admin_audit").insert({
    admin_user_id: admin.userId,
    admin_email: admin.email,
    action: "user.delete",
    target_type: "user",
    target_id: id,
    target_business_id: t.business_id,
    diff: { email: t.email, role: t.role },
  });
  return NextResponse.json({ ok: true });
}
