import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { assertTenantOnly } from "./guard";
import type { AgentContext } from "./types";

/**
 * Returns a Supabase client suitable for AI snapshot builders.
 *
 * Key invariants:
 *   1. The client uses the user's session cookie → RLS is enforced.
 *   2. Service-role keys are NEVER touched here. The factory in
 *      `lib/supabase/service-role.ts` is the only path to elevated
 *      privileges, and snapshot builders must not import it.
 *   3. Every DB read should pass its rows through `verifyRows()` below
 *      so we double-check `business_id` matches `ctx.businessId` even
 *      if RLS is misconfigured.
 *
 * Calling this without an `AgentContext` is a programmer error — the
 * argument is required so the type checker can't be confused into
 * thinking a snapshot builder is doing something un-scoped.
 */
export async function createAgentScopedClient(
  ctx: AgentContext,
): Promise<SupabaseClient> {
  if (!ctx?.businessId) {
    throw new Error(
      "[ai/context/client] AgentContext is missing businessId — refusing to build a client.",
    );
  }
  return createSupabaseServerClient();
}

/**
 * Convenience helper that runs `assertTenantOnly` automatically. Use
 * when the table you queried has a `business_id` column you want to
 * defensively re-check.
 *
 * ```ts
 * const rows = verifyRows(await q.select(...), ctx, 'invoices');
 * ```
 */
export function verifyRows<T extends { business_id?: string | null }>(
  result:
    | { data: T[] | null; error: unknown }
    | T[]
    | null
    | undefined,
  ctx: AgentContext,
  source: string,
): readonly T[] {
  if (!result) return [];
  if (Array.isArray(result)) return assertTenantOnly(result, ctx, source);
  // PostgrestResponse-like shape
  if ("data" in result) {
    return assertTenantOnly(result.data ?? [], ctx, source);
  }
  return [];
}
