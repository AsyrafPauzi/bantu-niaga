import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
 * DELETE /api/settings/team/invites/[id] — cancel a pending invite.
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

  const { id: inviteId } = await context.params;
  const svc = createServiceRoleClient();

  const { data: invite, error: fetchError } = await svc
    .from("team_invites")
    .select("id, email, role, auth_user_id, status")
    .eq("id", inviteId)
    .eq("business_id", user.businessId)
    .maybeSingle();

  if (fetchError || !invite) {
    return NextResponse.json({ error: "invite_not_found" }, { status: 404 });
  }

  if (invite.status !== "pending") {
    return NextResponse.json(
      { error: "invite_not_pending", message: "This invite is no longer pending." },
      { status: 400 },
    );
  }

  await svc
    .from("team_invites")
    .update({ status: "cancelled" })
    .eq("id", inviteId);

  if (invite.auth_user_id) {
    const { data: profile } = await svc
      .from("users")
      .select("id, last_password_change_at")
      .eq("id", invite.auth_user_id)
      .maybeSingle();

    if (profile && !profile.last_password_change_at) {
      await svc.from("users").delete().eq("id", invite.auth_user_id);
      try {
        await svc.auth.admin.deleteUser(invite.auth_user_id);
      } catch {
        // Best-effort cleanup for unactivated invites.
      }
    }
  }

  const supabase = await createSupabaseServerClient();
  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "team.invite_cancel",
    entity_type: "team_invite",
    entity_id: inviteId,
    diff: { email: invite.email, role: invite.role },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
