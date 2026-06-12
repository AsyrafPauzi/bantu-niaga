import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Phone-based customer dedup.
 *
 * @see docs/plans/marketing-implementation-plan.md §7.2
 *
 * Outcomes:
 *  - `new`    — no phone provided, or phone matches nothing.
 *  - `merge`  — phone matches an existing non-deleted, non-merged row in
 *               this business AND names look like the same person.
 *  - `prompt` — phone matches an existing row but names diverge.
 *
 * "Looks like the same person" is decided in two steps:
 *   1. Exact normalized-name match (lowercased, trimmed, single-spaced) →
 *      merge with no further work.
 *   2. Otherwise call the `marketing_name_similarity` RPC (pg_trgm wrapper)
 *      and merge iff the score ≥ FUZZY_NAME_THRESHOLD.
 *
 * Tombstoned rows (`deleted_at IS NOT NULL`) and merged-away rows
 * (`merged_into_id IS NOT NULL`) are explicitly excluded so the helper
 * stays correct when called via the service-role client (which bypasses
 * the RLS default-hide on soft-deleted rows).
 */

export type DedupAction = "new" | "merge" | "prompt";

export interface DedupInput {
  phone: string | null;
  name: string;
  businessId: string;
}

export interface DedupOutput {
  action: DedupAction;
  existingCustomerId?: string;
  existingName?: string;
}

/** Similarity threshold for "looks like the same person" auto-merge. */
export const FUZZY_NAME_THRESHOLD = 0.6;

export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

interface ExistingMatch {
  id: string;
  name: string;
}

export async function dedupCustomer(
  input: DedupInput,
  supabase: SupabaseClient,
): Promise<DedupOutput> {
  if (!input.businessId || typeof input.businessId !== "string") {
    throw new Error("dedupCustomer: businessId is required");
  }

  if (!input.phone) {
    return { action: "new" };
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, name")
    .eq("business_id", input.businessId)
    .eq("phone_e164", input.phone)
    .is("merged_into_id", null)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { action: "new" };

  const match = data as ExistingMatch;

  if (normalizeName(match.name) === normalizeName(input.name)) {
    return {
      action: "merge",
      existingCustomerId: match.id,
      existingName: match.name,
    };
  }

  const similarity = await fetchNameSimilarity(supabase, match.name, input.name);
  if (similarity >= FUZZY_NAME_THRESHOLD) {
    return {
      action: "merge",
      existingCustomerId: match.id,
      existingName: match.name,
    };
  }

  return {
    action: "prompt",
    existingCustomerId: match.id,
    existingName: match.name,
  };
}

async function fetchNameSimilarity(
  supabase: SupabaseClient,
  a: string,
  b: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("marketing_name_similarity", {
    a,
    b,
  });
  if (error) return 0;
  if (typeof data === "number") return data;
  return 0;
}
