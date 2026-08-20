import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Stamp customers.last_contacted_at for CTC / Mark-sent paths.
 * Always sets to `at` (default now). Scoped to live, unmerged rows.
 */
export async function touchCustomerLastContacted(
  supabase: SupabaseClient,
  businessId: string,
  customerId: string,
  at: Date = new Date(),
): Promise<void> {
  const { error } = await supabase
    .from("customers")
    .update({ last_contacted_at: at.toISOString() })
    .eq("business_id", businessId)
    .eq("id", customerId)
    .is("deleted_at", null)
    .is("merged_into_id", null);

  if (error) throw new Error(error.message);
}
