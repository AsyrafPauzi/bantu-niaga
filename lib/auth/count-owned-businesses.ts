import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function countOwnedBusinesses(userId: string): Promise<number> {
  const svc = createServiceRoleClient();
  const { count, error } = await svc
    .from("user_business_memberships")
    .select("business_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "owner");

  if (error) throw new Error(error.message);
  return count ?? 0;
}
