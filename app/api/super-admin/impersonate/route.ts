import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_TTL_MS,
  buildImpersonationCookieValue,
} from "@/lib/auth/impersonation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ targetUserId: z.string().uuid() }).strict();

/**
 * POST /api/super-admin/impersonate
 *
 * Platform-admin only. Starts an impersonation session targeting the
 * given tenant user. We:
 *   1. Verify the caller is a platform admin (guard redirects on fail).
 *   2. Look up the target user via service-role.
 *   3. Issue an httpOnly cookie carrying the target user id + admin
 *      identity. The cookie has a hard 1h TTL.
 *   4. Log the start in super_admin_audit for compliance.
 *
 * The client then navigates to /home and the tenant app resolves the
 * impersonated user via `getCurrentUser()`.
 */
export async function POST(request: Request) {
  const admin = await requirePlatformAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed: { targetUserId: string };
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
  const { data: target, error } = await svc
    .from("users")
    .select("id, business_id, display_name, email")
    .eq("id", parsed.targetUserId)
    .maybeSingle();
  if (error || !target) {
    return NextResponse.json(
      { error: "not_found", message: "Target user does not exist." },
      { status: 404 },
    );
  }

  await svc.from("super_admin_audit").insert({
    admin_user_id: admin.userId,
    admin_email: admin.email,
    action: "user.impersonate_start",
    target_type: "user",
    target_id: target.id,
    target_business_id: target.business_id,
    diff: {
      target_email: target.email,
      target_display_name: target.display_name,
    },
  });

  const value = buildImpersonationCookieValue({
    adminUserId: admin.userId,
    adminEmail: admin.email,
    targetUserId: target.id as string,
    targetBusinessId: target.business_id as string,
    targetDisplayName: target.display_name as string | null,
  });

  const res = NextResponse.json({
    ok: true,
    targetUserId: target.id,
    redirectTo: "/home",
  });
  res.cookies.set({
    name: IMPERSONATION_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.round(IMPERSONATION_TTL_MS / 1000),
  });
  return res;
}

/**
 * DELETE /api/super-admin/impersonate
 *
 * Stops the current impersonation session. Audited.
 */
export async function DELETE() {
  const admin = await requirePlatformAdmin();
  const svc = createServiceRoleClient();
  await svc.from("super_admin_audit").insert({
    admin_user_id: admin.userId,
    admin_email: admin.email,
    action: "user.impersonate_stop",
    target_type: "user",
    diff: {},
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: IMPERSONATION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
