import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z
  .object({
    email: z.string().email(),
    display_name: z.string().min(1).max(120).optional(),
    business_id: z.string().uuid(),
    role: z.enum([
      "owner",
      "manager",
      "accountant",
      "hr_officer",
      "cashier",
      "staff",
    ]),
  })
  .strict();

/**
 * POST /api/super-admin/users/invite
 *
 * Adds a user to a tenant from the super-admin view. We create the auth
 * row via Supabase Admin and let the existing `handle_new_user` trigger
 * populate `public.users`; we then patch the profile row with the
 * caller-supplied role + business_id.
 */
export async function POST(request: Request) {
  const admin = await requirePlatformAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed: z.infer<typeof schema>;
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

  // 1. Ensure tenant exists
  const { data: biz } = await svc
    .from("businesses")
    .select("id, name")
    .eq("id", parsed.business_id)
    .maybeSingle();
  if (!biz) {
    return NextResponse.json(
      { error: "business_not_found" },
      { status: 404 },
    );
  }

  // 2. Create auth user with an invitation email
  let authUserId: string;
  try {
    const { data, error } = await svc.auth.admin.inviteUserByEmail(
      parsed.email,
      {
        data: {
          display_name: parsed.display_name ?? parsed.email,
          business_id: parsed.business_id,
          role: parsed.role,
          invited_by: admin.userId,
        },
      },
    );
    if (error || !data?.user)
      throw new Error(error?.message ?? "invite_failed");
    authUserId = data.user.id;
  } catch (e) {
    return NextResponse.json(
      {
        error: "invite_failed",
        message: e instanceof Error ? e.message : "unknown",
      },
      { status: 500 },
    );
  }

  // 3. Upsert profile row
  await svc.from("users").upsert(
    {
      id: authUserId,
      business_id: parsed.business_id,
      email: parsed.email,
      display_name: parsed.display_name ?? parsed.email,
      role: parsed.role,
    },
    { onConflict: "id" },
  );

  await svc.from("super_admin_audit").insert({
    admin_user_id: admin.userId,
    admin_email: admin.email,
    action: "user.invite",
    target_type: "user",
    target_id: authUserId,
    target_business_id: parsed.business_id,
    diff: {
      email: parsed.email,
      role: parsed.role,
      business_name: (biz as { name: string }).name,
    },
  });

  return NextResponse.json(
    { ok: true, userId: authUserId },
    { status: 201 },
  );
}
