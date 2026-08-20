import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertSubscriptionWritable,
  SubscriptionPastDueError,
} from "@/lib/settings/subscription-writable";

export async function loadSubscriptionStatus(
  supabase: SupabaseClient,
  businessId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("businesses")
    .select("subscription_status")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.subscription_status ?? "active";
}

export async function assertBusinessSubscriptionWritable(
  supabase: SupabaseClient,
  businessId: string,
): Promise<void> {
  const status = await loadSubscriptionStatus(supabase, businessId);
  assertSubscriptionWritable(status);
}

export { SubscriptionPastDueError };
