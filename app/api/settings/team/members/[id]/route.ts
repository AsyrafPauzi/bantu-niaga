import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { teamMemberRoleSchema } from "@/lib/settings/schemas";
import type { Role } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function requireOwner() {
  const user = await getCurrentUser();
  if (user.role !== "owner") {
    return { denied: true as const, user };
  }
  return { denied: false as const, user };
}

/**
 * PATCH /api/settings/team/members/[id] — change a member's role.
 */
export async function PATCH(request: Request, context: RouteContext) {
  let user;
  try {
    const auth = await requireOwner();
    if (auth.denied) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    user = auth.user;
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const { id: memberId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = teamMemberRoleSchema.parse(body);
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
  const { data: member, error: fetchError } = await svc
    .from("user_business_memberships")
    .select("user_id, role, email, display_name")
    .eq("user_id", memberId)
    .eq("business_id", user.businessId)
    .maybeSingle();

  if (fetchError || !member) {
    return NextResponse.json({ error: "member_not_found" }, { status: 404 });
  }

  if ((member.role as Role) === "owner") {
    return NextResponse.json(
      { error: "cannot_change_owner", message: "Owner role cannot be changed here." },
      { status: 400 },
    );
  }

  if (memberId === user.id) {
    return NextResponse.json(
      { error: "cannot_change_self", message: "You cannot change your own role." },
      { status: 400 },
    );
  }

  const { data: updated, error: updateError } = await svc
    .from("user_business_memberships")
    .update({ role: parsed.role })
    .eq("user_id", memberId)
    .eq("business_id", user.businessId)
    .select("user_id, role, email, display_name, created_at")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  const { data: activeProfile } = await svc
    .from("users")
    .select("business_id")
    .eq("id", memberId)
    .maybeSingle();
  if (activeProfile?.business_id === user.businessId) {
    await svc.from("users").update({ role: parsed.role }).eq("id", memberId);
  }

  const supabase = await createSupabaseServerClient();
  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "team.role_change",
    entity_type: "user",
    entity_id: memberId,
    diff: {
      email: member.email,
      from: member.role,
      to: parsed.role,
    },
  });

  return NextResponse.json(
    {
      member: {
        id: updated.user_id,
        email: updated.email,
        display_name: updated.display_name,
        role: updated.role,
        created_at: updated.created_at,
        last_password_change_at: null,
      },
    },
    { status: 200 },
  );
}

/**
 * DELETE /api/settings/team/members/[id] — revoke access.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  let user;
  try {
    const auth = await requireOwner();
    if (auth.denied) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    user = auth.user;
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const { id: memberId } = await context.params;

  if (memberId === user.id) {
    return NextResponse.json(
      { error: "cannot_remove_self", message: "You cannot remove yourself." },
      { status: 400 },
    );
  }

  const svc = createServiceRoleClient();
  const { data: member, error: fetchError } = await svc
    .from("user_business_memberships")
    .select("user_id, role, email")
    .eq("user_id", memberId)
    .eq("business_id", user.businessId)
    .maybeSingle();

  if (fetchError || !member) {
    return NextResponse.json({ error: "member_not_found" }, { status: 404 });
  }

  if ((member.role as Role) === "owner") {
    const { count } = await svc
      .from("user_business_memberships")
      .select("id", { count: "exact", head: true })
      .eq("business_id", user.businessId)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        {
          error: "last_owner",
          message: "Cannot remove the only owner. Transfer ownership first.",
        },
        { status: 400 },
      );
    }
  }

  await svc
    .from("user_business_memberships")
    .delete()
    .eq("user_id", memberId)
    .eq("business_id", user.businessId);

  const { count: remainingMemberships } = await svc
    .from("user_business_memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", memberId);

  if ((remainingMemberships ?? 0) === 0) {
    await svc.from("users").delete().eq("id", memberId);
    try {
      await svc.auth.admin.deleteUser(memberId);
    } catch {
      // Profile removed; auth row may already be gone.
    }
  } else {
    const { data: activeProfile } = await svc
      .from("users")
      .select("business_id")
      .eq("id", memberId)
      .maybeSingle();
    if (activeProfile?.business_id === user.businessId) {
      const { data: fallback } = await svc
        .from("user_business_memberships")
        .select("business_id, role")
        .eq("user_id", memberId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (fallback) {
        await svc
          .from("users")
          .update({
            business_id: fallback.business_id,
            role: fallback.role,
          })
          .eq("id", memberId);
      }
    }
  }

  const supabase = await createSupabaseServerClient();
  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "team.member_remove",
    entity_type: "user",
    entity_id: memberId,
    diff: { email: member.email, role: member.role },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
