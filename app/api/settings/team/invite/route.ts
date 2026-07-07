import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadBusiness } from "@/lib/settings/business";
import { seatQuota } from "@/lib/settings/team-shared";
import { teamInviteSchema } from "@/lib/settings/schemas";
import { authCallbackUrl } from "@/lib/auth/site-url";
import { ensureMembership } from "@/lib/auth/memberships";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireOwner() {
  const user = await getCurrentUser();
  if (user.role !== "owner") {
    return { denied: true as const, user };
  }
  return { denied: false as const, user };
}

async function countSeatsUsed(businessId: string): Promise<number> {
  const svc = createServiceRoleClient();
  const [membersRes, invitesRes] = await Promise.all([
    svc
      .from("user_business_memberships")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    svc
      .from("team_invites")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "pending"),
  ]);
  return (membersRes.count ?? 0) + (invitesRes.count ?? 0);
}

/**
 * POST /api/settings/team/invite — owner sends a magic-link invite.
 */
export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = teamInviteSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const email = parsed.email.trim().toLowerCase();
  const svc = createServiceRoleClient();

  const business = await loadBusiness(user.businessId);
  if (!business) {
    return NextResponse.json({ error: "business_not_found" }, { status: 404 });
  }

  const quota = seatQuota(business.tier);
  const used = await countSeatsUsed(user.businessId);
  if (used >= quota) {
    return NextResponse.json(
      {
        error: "seat_limit_reached",
        message: `Your ${business.tier} plan allows ${quota} seat${quota === 1 ? "" : "s"}. Upgrade or remove a member first.`,
      },
      { status: 409 },
    );
  }

  const { data: existingMember } = await svc
    .from("user_business_memberships")
    .select("user_id")
    .eq("business_id", user.businessId)
    .ilike("email", email)
    .maybeSingle();
  if (existingMember) {
    return NextResponse.json(
      { error: "already_member", message: "This email is already on your team." },
      { status: 409 },
    );
  }

  const { data: pendingInvite } = await svc
    .from("team_invites")
    .select("id")
    .eq("business_id", user.businessId)
    .eq("status", "pending")
    .ilike("email", email)
    .maybeSingle();
  if (pendingInvite) {
    return NextResponse.json(
      { error: "invite_pending", message: "An invite is already pending for this email." },
      { status: 409 },
    );
  }

  const { data: inviteRow, error: inviteInsertError } = await svc
    .from("team_invites")
    .insert({
      business_id: user.businessId,
      email,
      role: parsed.role,
      display_name: parsed.display_name ?? null,
      invited_by: user.id,
      status: "pending",
    })
    .select("id, email, role, display_name, status, expires_at, created_at")
    .maybeSingle();

  if (inviteInsertError || !inviteRow) {
    return NextResponse.json(
      { error: "invite_record_failed", message: inviteInsertError?.message },
      { status: 500 },
    );
  }

  const siteUrl = authCallbackUrl(
    "/accept-invite",
    request.headers.get("origin"),
  );

  const inviteMetadata = {
    display_name: parsed.display_name ?? email,
    business_id: user.businessId,
    role: parsed.role,
    invited_by: user.id,
    invite_id: inviteRow.id,
    team_invite: true,
  };

  let authUserId: string | null = null;
  let inviteEmailSent = true;
  let devInviteLink: string | null = null;

  try {
    const { data, error } = await svc.auth.admin.inviteUserByEmail(email, {
      redirectTo: siteUrl,
      data: inviteMetadata,
    });

    if (error || !data?.user) {
      const msg = error?.message ?? "invite_failed";
      if (
        msg.toLowerCase().includes("already") ||
        msg.toLowerCase().includes("registered")
      ) {
        await svc
          .from("team_invites")
          .update({ status: "cancelled" })
          .eq("id", inviteRow.id);
        return NextResponse.json(
          {
            error: "email_in_use",
            message:
              "This email already has a Bantu Niaga account. Use a different email or ask them to contact support.",
          },
          { status: 409 },
        );
      }
      if (
        process.env.NODE_ENV === "development" &&
        !process.env.SUPABASE_INVITE_EMAIL_ENABLED
      ) {
        const { data: created, error: createErr } =
          await svc.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: inviteMetadata,
          });
        if (createErr || !created.user) {
          throw new Error(createErr?.message ?? msg);
        }
        authUserId = created.user.id;

        const { data: linkData, error: linkErr } =
          await svc.auth.admin.generateLink({
            type: "invite",
            email,
            options: {
              redirectTo: siteUrl,
              data: inviteMetadata,
            },
          });
        if (linkErr || !linkData?.properties?.action_link) {
          throw new Error(linkErr?.message ?? "Could not generate invite link.");
        }
        devInviteLink = linkData.properties.action_link;
        inviteEmailSent = false;
      } else {
        throw new Error(msg);
      }
    } else {
      authUserId = data.user.id;
    }
  } catch (e) {
    await svc
      .from("team_invites")
      .update({ status: "cancelled" })
      .eq("id", inviteRow.id);
    return NextResponse.json(
      {
        error: "invite_failed",
        message: e instanceof Error ? e.message : "Could not send invite.",
      },
      { status: 500 },
    );
  }

  if (authUserId) {
    const { data: existingProfile } = await svc
      .from("users")
      .select("id, business_id")
      .eq("id", authUserId)
      .maybeSingle();

    if (!existingProfile) {
      await svc.from("users").insert({
        id: authUserId,
        business_id: user.businessId,
        email,
        display_name: parsed.display_name ?? email,
        role: parsed.role,
      });
    }

    await ensureMembership(authUserId, user.businessId, parsed.role, {
      email,
      display_name: parsed.display_name ?? email,
    });

    await svc
      .from("team_invites")
      .update({
        auth_user_id: authUserId,
        status: "pending",
        accepted_at: null,
      })
      .eq("id", inviteRow.id);
  }

  const supabase = await createSupabaseServerClient();
  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "team.invite",
    entity_type: "team_invite",
    entity_id: inviteRow.id,
    diff: { email, role: parsed.role, invite_email_sent: inviteEmailSent },
  });

  return NextResponse.json(
    {
      invite: inviteRow,
      invite_email_sent: inviteEmailSent,
      dev_bypass: !inviteEmailSent && process.env.NODE_ENV === "development",
      dev_invite_link: devInviteLink,
    },
    { status: 201 },
  );
}
