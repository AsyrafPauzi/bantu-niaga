import "server-only";

import { unstable_cache } from "next/cache";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

import { buildHrSnapshot, type HrSnapshotOptions } from "./hr";
import type { AgentContext, PillarSnapshot } from "./types";

/** Cross-request TTL for HR AI briefing snapshots. */
export const HR_BRIEFING_REVALIDATE_SECONDS = 120;

function appraisalsCacheKey(includeStaffAppraisals?: boolean): string {
  if (includeStaffAppraisals === undefined) return "auto";
  return includeStaffAppraisals ? "true" : "false";
}

/**
 * HR briefing snapshot with cross-request caching per tenant.
 * Uses service-role reads with explicit `business_id` scoping inside
 * `buildHrSnapshot` — safe for `unstable_cache` (no cookies).
 */
export function buildCachedHrSnapshot(
  ctx: AgentContext,
  options?: HrSnapshotOptions,
): Promise<PillarSnapshot> {
  const businessId = ctx.businessId;
  const appraisalsKey = appraisalsCacheKey(options?.includeStaffAppraisals);

  return unstable_cache(
    async () => {
      const client = createServiceRoleClient();
      return buildHrSnapshot(ctx, client, options);
    },
    ["hr-briefing-snapshot", businessId, appraisalsKey],
    {
      revalidate: HR_BRIEFING_REVALIDATE_SECONDS,
      tags: [`hr-briefing:${businessId}`],
    },
  )();
}
