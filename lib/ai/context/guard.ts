import "server-only";
import { cache } from "react";

import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";

import type { AgentContext } from "./types";

/**
 * Resolve the AgentContext for the current request.
 *
 * Hard guarantees:
 *   1. `businessId` ALWAYS comes from `public.users` via `getCurrentUser()`.
 *      It is never derived from request input.
 *   2. The result is `Readonly` (TypeScript + Object.freeze) so consumers
 *      cannot mutate the businessId in flight.
 *   3. `cache()` memoises per-request so repeated calls share a single
 *      DB round-trip, but the value is identity-safe (same render, same
 *      object).
 *
 * If `getCurrentUser()` throws `UnauthorizedError`, this function
 * re-throws — the caller is responsible for the 401 response.
 */
export const resolveAgentContext = cache(
  async (): Promise<AgentContext> => {
    const user = await getCurrentUser();
    const ctx: AgentContext = Object.freeze({
      businessId: user.businessId,
      userId: user.id,
      role: user.role,
      impersonated: !!user.impersonatedBy,
    });
    return ctx;
  },
);

/**
 * Defence-in-depth runtime assertion. Throws if any row in `rows` does
 * NOT belong to `ctx.businessId`. Use immediately after every DB read
 * inside a snapshot builder so a misconfigured RLS policy (or a stray
 * service-role client) can never leak cross-tenant data into the
 * agent's prompt.
 *
 * Snapshot builders MUST call this — there is no performance reason
 * not to (the check is O(n) over rows we were about to render anyway).
 */
export function assertTenantOnly<T extends { business_id?: string | null }>(
  rows: readonly T[] | null | undefined,
  ctx: AgentContext,
  source: string,
): readonly T[] {
  if (!rows) return [];
  for (const r of rows) {
    if (!r.business_id) continue; // join rows without business_id columns
    if (r.business_id !== ctx.businessId) {
      throw new TenantIsolationViolation(
        `[AI context] ${source}: row with business_id=${String(r.business_id)} leaked into tenant ${ctx.businessId}`,
      );
    }
  }
  return rows;
}

export class TenantIsolationViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantIsolationViolation";
  }
}

/**
 * Soft alias for the common pattern:
 *   const ctx = await resolveAgentContext();
 *   if (ctx.businessId !== expected) throw …
 *
 * Useful when an API handler accepts an explicit `business_id` argument
 * and we want to fail loudly if it ever disagrees with the resolved
 * tenant. Returns the resolved context on success.
 */
export async function requireSameTenant(
  candidateBusinessId: string,
): Promise<AgentContext> {
  const ctx = await resolveAgentContext();
  if (ctx.businessId !== candidateBusinessId) {
    throw new TenantIsolationViolation(
      `[AI context] business_id mismatch: caller=${ctx.businessId} requested=${candidateBusinessId}`,
    );
  }
  return ctx;
}

export { UnauthorizedError } from "@/lib/auth/current-user";
