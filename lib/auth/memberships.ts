import "server-only";

import { cache } from "react";
import { ROLES, type Role } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface BusinessMembership {
  businessId: string;
  businessName: string;
  role: Role;
  isActive: boolean;
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * All businesses the signed-in user can switch to.
 */
export const loadUserMemberships = cache(
  async (userId: string, activeBusinessId: string): Promise<BusinessMembership[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("user_business_memberships")
      .select("business_id, role, businesses(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((row) => isRole(row.role))
      .map((row) => {
        const biz = row.businesses as { name?: string } | null;
        return {
          businessId: row.business_id as string,
          businessName: biz?.name ?? "Business",
          role: row.role as Role,
          isActive: row.business_id === activeBusinessId,
        };
      });
  },
);

export interface SwitchBusinessResult {
  businessId: string;
  role: Role;
}

/**
 * Switch the user's active tenant context. Updates public.users so RLS
 * (current_business_id) continues to work without rewriting every policy.
 */
export async function switchActiveBusiness(
  userId: string,
  businessId: string,
): Promise<SwitchBusinessResult | null> {
  const svc = createServiceRoleClient();

  const { data: membership } = await svc
    .from("user_business_memberships")
    .select("business_id, role")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!membership || !isRole(membership.role)) return null;

  const { error } = await svc
    .from("users")
    .update({
      business_id: membership.business_id,
      role: membership.role,
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  return {
    businessId: membership.business_id,
    role: membership.role,
  };
}

export async function ensureMembership(
  userId: string,
  businessId: string,
  role: Role,
  profile?: { email?: string | null; display_name?: string | null },
): Promise<void> {
  const svc = createServiceRoleClient();
  const { error } = await svc.from("user_business_memberships").upsert(
    {
      user_id: userId,
      business_id: businessId,
      role,
      email: profile?.email ?? null,
      display_name: profile?.display_name ?? null,
    },
    { onConflict: "user_id,business_id" },
  );
  if (error) throw new Error(error.message);
}
