import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadBusiness } from "@/lib/settings/business";
import { seatQuota } from "@/lib/settings/team-shared";
import { teamInviteSchema } from "@/lib/settings/schemas";
import { ensureMembership } from "@/lib/auth/memberships";
import {
  hasAppResendConfigured,
  isSupabaseInviteEmailEnabled,
  shouldDeliverInviteViaAppResend,
} from "@/lib/auth/invite-email";
import { authCallbackUrl } from "@/lib/auth/site-url";

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
  let reattachedExisting = false;

  try {
    const provisioned = await provisionTeamAuthUser({
      svc,
      email,
      siteUrl,
      homeRedirect: authCallbackUrl("/home", request.headers.get("origin")),
      inviteMetadata,
      businessName: business.name ?? "your team",
      inviterName: "A teammate",
    });
    authUserId = provisioned.authUserId;
    devInviteLink = provisioned.actionLink;
    inviteEmailSent = provisioned.inviteEmailSent;
    reattachedExisting = provisioned.reattachedExisting;
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
    } else {
      await svc
        .from("users")
        .update({
          business_id: user.businessId,
          role: parsed.role,
          display_name: parsed.display_name ?? email,
          email,
        })
        .eq("id", authUserId);
    }

    await ensureMembership(authUserId, user.businessId, parsed.role, {
      email,
      display_name: parsed.display_name ?? email,
    });

    await svc
      .from("team_invites")
      .update({
        auth_user_id: authUserId,
        status: reattachedExisting ? "accepted" : "pending",
        accepted_at: reattachedExisting ? new Date().toISOString() : null,
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
    diff: {
      email,
      role: parsed.role,
      invite_email_sent: inviteEmailSent,
      reattached_existing: reattachedExisting,
    },
  });

  return NextResponse.json(
    {
      invite: {
        ...inviteRow,
        status: reattachedExisting ? "accepted" : inviteRow.status,
      },
      invite_email_sent: inviteEmailSent,
      reattached_existing: reattachedExisting,
      message: reattachedExisting
        ? "Member re-added. They can sign in with their existing password."
        : undefined,
      dev_bypass: Boolean(devInviteLink) && !inviteEmailSent && !isSupabaseInviteEmailEnabled(),
      join_link: inviteEmailSent ? null : devInviteLink,
      dev_invite_link: inviteEmailSent ? null : devInviteLink,
    },
    { status: 201 },
  );
}

/**
 * Create or reuse an Auth user for a team invite.
 * When invite email is enabled, prefer inviteUserByEmail (triggers Supabase
 * Send Email hook / SMTP). generateLink alone never sends mail.
 */
async function provisionTeamAuthUser(opts: {
  svc: ReturnType<typeof createServiceRoleClient>;
  email: string;
  siteUrl: string;
  homeRedirect: string;
  inviteMetadata: Record<string, unknown>;
  businessName: string;
  inviterName: string;
}): Promise<{
  authUserId: string;
  actionLink: string | null;
  inviteEmailSent: boolean;
  reattachedExisting: boolean;
}> {
  const {
    svc,
    email,
    siteUrl,
    homeRedirect,
    inviteMetadata,
    businessName,
    inviterName,
  } = opts;
  const emailEnabled = isSupabaseInviteEmailEnabled();

  if (emailEnabled) {
    // Local + Resend: provision Auth user without inviteUserByEmail so GoTrue
    // does not also send (that caused duplicate invites).
    const appResendOnly =
      shouldDeliverInviteViaAppResend(siteUrl) && hasAppResendConfigured();

    if (appResendOnly) {
      return provisionInviteViaAppResend({
        svc,
        email,
        siteUrl,
        inviteMetadata,
        businessName,
        inviterName,
      });
    }

    const invited = await svc.auth.admin.inviteUserByEmail(email, {
      redirectTo: siteUrl,
      data: inviteMetadata,
    });

    if (!invited.error && invited.data?.user?.id) {
      return {
        authUserId: invited.data.user.id,
        actionLink: null,
        inviteEmailSent: true,
        reattachedExisting: false,
      };
    }

    const msg = invited.error?.message ?? "invite_failed";
    const already =
      msg.toLowerCase().includes("already") ||
      msg.toLowerCase().includes("registered");

    if (!already) {
      throw new Error(msg);
    }

    const existing = await findAuthUserByEmail(svc, email);
    if (!existing) {
      throw new Error(
        "This email exists in Auth but could not be linked. Delete it in Supabase → Authentication → Users, then invite again.",
      );
    }

    const { data: profile } = await svc
      .from("users")
      .select("last_password_change_at")
      .eq("id", existing.id)
      .maybeSingle();
    const hasPassword = Boolean(profile?.last_password_change_at);

    if (hasPassword) {
      await svc.auth.admin.updateUserById(existing.id, {
        user_metadata: inviteMetadata,
        email_confirm: true,
      });
      return {
        authUserId: existing.id,
        actionLink: null,
        inviteEmailSent: false,
        reattachedExisting: true,
      };
    }

    // Incomplete prior invite — remove Auth user and send a fresh invite email.
    await svc.from("users").delete().eq("id", existing.id);
    const { error: delErr } = await svc.auth.admin.deleteUser(existing.id);
    if (delErr) {
      await svc.auth.admin.updateUserById(existing.id, {
        user_metadata: inviteMetadata,
        email_confirm: true,
      });
      if (hasAppResendConfigured()) {
        return deliverInviteViaAppResendOnly({
          svc,
          email,
          siteUrl,
          inviteMetadata,
          businessName,
          inviterName,
          authUserId: existing.id,
        });
      }
      throw new Error(
        delErr.message ||
          "Could not recreate invite. Delete the Auth user in Supabase, then try again.",
      );
    }

    const retried = await svc.auth.admin.inviteUserByEmail(email, {
      redirectTo: siteUrl,
      data: inviteMetadata,
    });
    if (retried.error || !retried.data?.user?.id) {
      throw new Error(retried.error?.message ?? msg);
    }
    return {
      authUserId: retried.data.user.id,
      actionLink: null,
      inviteEmailSent: true,
      reattachedExisting: false,
    };
  }

  // Local / no-email mode: create or reuse Auth user and return a copyable link.
  const magic = await svc.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: siteUrl, data: inviteMetadata },
  });

  if (!magic.error && magic.data?.user?.id) {
    const authUserId = magic.data.user.id;
    await svc.auth.admin.updateUserById(authUserId, {
      user_metadata: inviteMetadata,
      email_confirm: true,
    });
    const { data: profile } = await svc
      .from("users")
      .select("last_password_change_at")
      .eq("id", authUserId)
      .maybeSingle();
    if (profile?.last_password_change_at) {
      const homeLink = await svc.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: homeRedirect },
      });
      return {
        authUserId,
        actionLink:
          homeLink.data?.properties?.action_link ??
          magic.data.properties?.action_link ??
          null,
        inviteEmailSent: false,
        reattachedExisting: true,
      };
    }
    return {
      authUserId,
      actionLink: magic.data.properties?.action_link ?? null,
      inviteEmailSent: false,
      reattachedExisting: false,
    };
  }

  const created = await svc.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: inviteMetadata,
  });
  if (created.error || !created.data.user) {
    const existing = await findAuthUserByEmail(svc, email);
    if (!existing) throw new Error(created.error?.message ?? "invite_failed");
    const link = await svc.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: siteUrl, data: inviteMetadata },
    });
    return {
      authUserId: existing.id,
      actionLink: link.data?.properties?.action_link ?? null,
      inviteEmailSent: false,
      reattachedExisting: false,
    };
  }
  const link = await svc.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo: siteUrl, data: inviteMetadata },
  });
  return {
    authUserId: created.data.user.id,
    actionLink: link.data?.properties?.action_link ?? null,
    inviteEmailSent: false,
    reattachedExisting: false,
  };
}

async function provisionInviteViaAppResend(opts: {
  svc: ReturnType<typeof createServiceRoleClient>;
  email: string;
  siteUrl: string;
  inviteMetadata: Record<string, unknown>;
  businessName: string;
  inviterName: string;
}): Promise<{
  authUserId: string;
  actionLink: string | null;
  inviteEmailSent: boolean;
  reattachedExisting: boolean;
}> {
  const { svc, email, siteUrl, inviteMetadata, businessName, inviterName } =
    opts;

  const existing = await findAuthUserByEmail(svc, email);
  if (existing) {
    const { data: profile } = await svc
      .from("users")
      .select("last_password_change_at")
      .eq("id", existing.id)
      .maybeSingle();
    if (profile?.last_password_change_at) {
      await svc.auth.admin.updateUserById(existing.id, {
        user_metadata: inviteMetadata,
        email_confirm: true,
      });
      return {
        authUserId: existing.id,
        actionLink: null,
        inviteEmailSent: false,
        reattachedExisting: true,
      };
    }
    await svc.auth.admin.updateUserById(existing.id, {
      user_metadata: inviteMetadata,
      email_confirm: true,
    });
    return deliverInviteViaAppResendOnly({
      svc,
      email,
      siteUrl,
      inviteMetadata,
      businessName,
      inviterName,
      authUserId: existing.id,
    });
  }

  const created = await svc.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: inviteMetadata,
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? "invite_failed");
  }
  return deliverInviteViaAppResendOnly({
    svc,
    email,
    siteUrl,
    inviteMetadata,
    businessName,
    inviterName,
    authUserId: created.data.user.id,
  });
}

/** Send exactly one invite email via Resend (no GoTrue mail). */
async function deliverInviteViaAppResendOnly(opts: {
  svc: ReturnType<typeof createServiceRoleClient>;
  email: string;
  siteUrl: string;
  inviteMetadata: Record<string, unknown>;
  businessName: string;
  inviterName: string;
  authUserId: string;
}): Promise<{
  authUserId: string;
  actionLink: string | null;
  inviteEmailSent: boolean;
  reattachedExisting: boolean;
}> {
  // After createUser({ email_confirm: true }), type "invite" often returns no
  // action_link. Prefer magiclink (same accept-invite redirect).
  let actionLink: string | null = null;
  let lastError = "";

  for (const type of ["magiclink", "invite"] as const) {
    const link = await opts.svc.auth.admin.generateLink({
      type,
      email: opts.email,
      options: {
        redirectTo: opts.siteUrl,
        data: opts.inviteMetadata,
      },
    });
    actionLink = link.data?.properties?.action_link ?? null;
    if (actionLink) break;
    lastError = link.error?.message ?? "no action_link";
  }

  if (!actionLink) {
    throw new Error(
      lastError
        ? `Could not create invite join link: ${lastError}`
        : "Could not create invite join link.",
    );
  }
  const sent = await sendTeamInviteJoinEmail({
    to: opts.email,
    actionLink,
    businessName: opts.businessName,
    inviterName: opts.inviterName,
  });
  return {
    authUserId: opts.authUserId,
    actionLink: sent ? null : actionLink,
    inviteEmailSent: sent,
    reattachedExisting: false,
  };
}

async function sendTeamInviteJoinEmail(opts: {
  to: string;
  actionLink: string;
  businessName: string;
  inviterName: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const fromEmail = process.env.MARKETING_FROM_EMAIL?.trim() ?? "";
  if (!apiKey || !fromEmail) return false;

  const { authEmailCopy } = await import("@/lib/email/copy");
  const { renderNiagaXEmail } = await import("@/lib/email/layout");
  const { sendEmail } = await import("@/lib/marketing/email-resend");

  const copy = authEmailCopy("invite", "en", {
    businessName: opts.businessName,
    inviterName: opts.inviterName,
  });
  const html = renderNiagaXEmail({
    locale: "en",
    brandName: "NiagaX",
    subject: copy.subject,
    heading: copy.heading,
    bodyText: copy.bodyText,
    footerText: copy.footerText,
    ctaHref: opts.actionLink,
    ctaLabel: copy.ctaLabel,
    previewText: copy.bodyText,
  });

  const result = await sendEmail({
    to: opts.to,
    subject: copy.subject,
    body: `${copy.bodyText}\n\n${opts.actionLink}`,
    html,
    fromEmail,
    apiKey,
  });
  return result.ok === true;
}

async function findAuthUserByEmail(
  svc: ReturnType<typeof createServiceRoleClient>,
  email: string,
): Promise<{ id: string } | null> {
  const normalized = email.trim().toLowerCase();

  // Do not probe with generateLink — it burns Auth email rate limits and can
  // make the real invite link generation fail.
  const { data: profile } = await svc
    .from("users")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();
  if (profile?.id) {
    const { data } = await svc.auth.admin.getUserById(profile.id);
    if (data?.user) return { id: data.user.id };
  }

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await svc.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || !data?.users?.length) break;
    const hit = data.users.find(
      (u) => (u.email ?? "").trim().toLowerCase() === normalized,
    );
    if (hit) return { id: hit.id };
    if (data.users.length < 200) break;
  }

  return null;
}
