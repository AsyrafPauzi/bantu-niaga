import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TierKey } from "@/lib/settings/plans";

export async function loadBusinessTier(
  businessId: string,
  client?: SupabaseClient,
): Promise<TierKey> {
  const supabase = client ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("businesses")
    .select("tier")
    .eq("id", businessId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.tier as TierKey) ?? "starter";
}
