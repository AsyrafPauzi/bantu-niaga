import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { Role } from "@/lib/permissions";
import { resetPasswordSchema } from "@/lib/auth/schemas";
import { ensureMembership } from "@/lib/auth/memberships";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/auth/accept-invite — context for the accept-invite page.
 * Requires an active session from the invite email link.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "no_invite_session",
        message: "Your invite link has expired. Ask your owner to send a new invite.",
      },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, display_name, business_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.business_id) {
    return NextResponse.json(
      {
        error: "profile_missing",
        message: "Your team profile is not ready yet. Contact your business owner.",
      },
      { status: 409 },
    );
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", profile.business_id)
    .maybeSingle();

  const inviteId =
    typeof user.user_metadata?.invite_id === "string"
      ? user.user_metadata.invite_id
      : null;

  return NextResponse.json({
    email: user.email,
    display_name: profile.display_name,
    role: profile.role,
    business_name: business?.name ?? "your team",
    invite_id: inviteId,
  });
}

/**
 * POST /api/auth/accept-invite — set password and complete a team invite.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = resetPasswordSchema.parse(body);
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "no_invite_session",
        message: "Your invite link has expired. Ask your owner to send a new invite.",
      },
      { status: 401 },
    );
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.new_password,
  });
  if (updateError) {
    return NextResponse.json(
      { error: "update_failed", message: updateError.message },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const { data: profile } = await supabase
    .from("users")
    .select("business_id, role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  await supabase
    .from("users")
    .update({ last_password_change_at: now })
    .eq("id", user.id);

  const inviteId =
    typeof user.user_metadata?.invite_id === "string"
      ? user.user_metadata.invite_id
      : null;

  if (inviteId) {
    const svc = createServiceRoleClient();
    await svc
      .from("team_invites")
      .update({
        status: "accepted",
        accepted_at: now,
        auth_user_id: user.id,
      })
      .eq("id", inviteId)
      .eq("business_id", profile?.business_id ?? "")
      .in("status", ["pending", "accepted"]);
  }

  if (profile?.business_id) {
    await supabase.from("audit_log").insert({
      business_id: profile.business_id,
      actor_user_id: user.id,
      action: "team.invite_accepted",
      entity_type: "team_invite",
      entity_id: inviteId,
      diff: { email: user.email, role: profile.role },
    });
  }

  if (profile?.business_id && profile.role) {
    await ensureMembership(user.id, profile.business_id, profile.role as Role, {
      email: user.email,
      display_name: profile.display_name,
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
