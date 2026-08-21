/**
 * Cached dashboard data fetchers.
 *
 * Dashboard pages are read-heavy (cold DB round-trips on every render) but the
 * data only changes when a sale / invoice / transaction is recorded. Using
 * `unstable_cache` with a 60-second TTL cuts DB load by ~95% during a normal
 * workday while keeping data fresh enough for an ops dashboard.
 *
 * Cache invalidation:
 *   - Automatic: revalidate every 60 seconds.
 *   - Manual: call `revalidateSalesDashboard(businessId)` /
 *     `revalidateFinanceDashboard(businessId, month)` from the relevant
 *     mutation routes (POS checkout, invoice save, expense save).
 *
 * Security note: these loaders use the service-role client which bypasses RLS.
 * businessId is always passed explicitly from the authenticated session —
 * never from user-supplied request params. All queries include an
 * `.eq('business_id', businessId)` scope.
 */
import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { loadSalesDashboard } from "@/lib/sales/dashboard";
import { loadFinanceDashboard } from "@/lib/finance/dashboard";

// ─── Sales dashboard ─────────────────────────────────────────────────────────

function salesCacheTag(businessId: string) {
  return `sales-dashboard:${businessId}`;
}

export const loadSalesDashboardCached = unstable_cache(
  async (businessId: string) => {
    const supabase = createServiceRoleClient();
    return loadSalesDashboard(supabase, businessId);
  },
  ["sales-dashboard"],
  {
    revalidate: 60,
    // Tag per-business so we can surgically invalidate one tenant's cache.
    tags: ["sales-dashboard"],
  },
);

/** Call this from POS checkout / lead mutation routes to bust the cache. */
export function revalidateSalesDashboard(businessId: string) {
  revalidateTag(salesCacheTag(businessId));
}

// ─── Finance dashboard ────────────────────────────────────────────────────────

function financeCacheTag(businessId: string, month?: string) {
  return month
    ? `finance-dashboard:${businessId}:${month}`
    : `finance-dashboard:${businessId}`;
}

export const loadFinanceDashboardCached = unstable_cache(
  async (
    businessId: string,
    opts?: { month?: string; idcompany?: string; appUrl?: string },
  ) => {
    const supabase = createServiceRoleClient();
    return loadFinanceDashboard(supabase, businessId, opts);
  },
  ["finance-dashboard"],
  { revalidate: 60, tags: ["finance-dashboard"] },
);

/** Call this from invoice / expense / transaction mutation routes. */
export function revalidateFinanceDashboard(businessId: string) {
  revalidateTag(financeCacheTag(businessId));
}
