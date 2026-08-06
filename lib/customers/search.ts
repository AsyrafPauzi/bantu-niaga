import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CustomerSearchRow {
  id: string;
  name: string;
  phone_e164: string | null;
}

export interface CustomerSearchOptions {
  businessId: string;
  query: string;
  limit: number;
  /** Extra columns beyond id, name, phone_e164 */
  select?: string;
}

function sanitizeCustomerSearchQuery(q: string): string {
  return q.replace(/[\\*,()]/g, "");
}

/**
 * Prefix search on customers.name and phone_e164.
 * Caller must enforce RBAC before calling.
 */
export async function searchCustomers(
  supabase: SupabaseClient,
  opts: CustomerSearchOptions,
): Promise<CustomerSearchRow[]> {
  const safe = sanitizeCustomerSearchQuery(opts.query.trim());
  if (!safe) return [];

  const select =
    opts.select ?? "id, name, phone_e164";

  const { data, error } = await supabase
    .from("customers")
    .select(select)
    .eq("business_id", opts.businessId)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .or(`name.ilike.*${safe}*,phone_e164.ilike.${safe}*`)
    .order("name", { ascending: true })
    .limit(opts.limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CustomerSearchRow[];
}

export { sanitizeCustomerSearchQuery };
