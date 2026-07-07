import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLES, type Role } from "@/lib/permissions";
import {
  type TeamInviteRow,
  type TeamMemberRow,
} from "@/lib/settings/team-shared";

export {
  INVITEABLE_ROLES,
  ROLE_LABELS,
  roleSummary,
  seatQuota,
  type InviteableRole,
  type TeamInviteRow,
  type TeamMemberRow,
} from "@/lib/settings/team-shared";

export const loadTeamMembers = cache(
  async (businessId: string): Promise<TeamMemberRow[]> => {
    const supabase = await createSupabaseServerClient();
    const { data: memberships, error } = await supabase
      .from("user_business_memberships")
      .select("user_id, role, created_at, email, display_name")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    if (!memberships?.length) return [];

    const userIds = memberships.map((row) => row.user_id as string);
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select(
        "id, email, display_name, last_password_change_at, deletion_scheduled_for",
      )
      .in("id", userIds)
      .is("deletion_scheduled_for", null);

    if (usersError) throw new Error(usersError.message);

    const userById = new Map(
      (users ?? []).map((row) => [
        row.id as string,
        row as {
          id: string;
          email: string | null;
          display_name: string | null;
          last_password_change_at: string | null;
        },
      ]),
    );

    return memberships
      .map((row) => {
        const profile = userById.get(row.user_id as string);
        if (!profile) return null;
        const role = row.role;
        if (!ROLES.includes(role as Role)) return null;
        return {
          id: profile.id,
          email: profile.email ?? (row.email as string | null),
          display_name:
            profile.display_name ?? (row.display_name as string | null),
          role: role as Role,
          created_at: row.created_at as string,
          last_password_change_at: profile.last_password_change_at,
        };
      })
      .filter((row): row is TeamMemberRow => row !== null);
  },
);

export const loadTeamInvites = cache(
  async (businessId: string): Promise<TeamInviteRow[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("team_invites")
      .select("id, email, role, display_name, status, expires_at, created_at")
      .eq("business_id", businessId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") return [];
      throw new Error(error.message);
    }

    return (data ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role as Role,
      display_name: r.display_name,
      status: r.status as TeamInviteRow["status"],
      expires_at: r.expires_at,
      created_at: r.created_at,
    }));
  },
);

export async function loadTeamAudit(
  businessId: string,
  limit = 12,
): Promise<
  Array<{
    id: string;
    action: string;
    created_at: string;
  }>
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, action, created_at")
    .eq("business_id", businessId)
    .or(
      "action.ilike.team.%,action.ilike.settings.team%,action.eq.auth.sign_up",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data ?? [];
}
