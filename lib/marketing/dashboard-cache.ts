import "server-only";

import { unstable_cache } from "next/cache";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

import {
  getCustomerGrowthSeries,
  getKpiDeltas,
  getKpiSnapshot,
  getRecentActivity,
  getTopCustomers,
  getTopPostedContent,
  getUpcomingContent,
  type ActivityRow,
  type GrowthPoint,
  type KpiDeltas,
  type KpiSnapshotResult,
  type TopContentRow,
  type TopCustomerRow,
  type UpcomingContentRow,
} from "./dashboard-queries";

/** Cross-request TTL for the marketing overview dashboard bundle. */
export const MARKETING_DASHBOARD_REVALIDATE_SECONDS = 90;

export interface MarketingDashboardSnapshot {
  snapshot: KpiSnapshotResult;
  deltas: KpiDeltas;
  growth: GrowthPoint[];
  topCustomers: TopCustomerRow[];
  upcoming: UpcomingContentRow[];
  activity: ActivityRow[];
  topContent: TopContentRow[];
}

async function fetchMarketingDashboardSnapshot(
  businessId: string,
): Promise<MarketingDashboardSnapshot> {
  const supabase = createServiceRoleClient();
  const [
    snapshot,
    deltas,
    growth,
    topCustomers,
    upcoming,
    activity,
    topContent,
  ] = await Promise.all([
    getKpiSnapshot(supabase, businessId),
    getKpiDeltas(supabase, businessId),
    getCustomerGrowthSeries(supabase, businessId, 12),
    getTopCustomers(supabase, businessId, 5),
    getUpcomingContent(supabase, businessId, 7),
    getRecentActivity(supabase, businessId, 5),
    getTopPostedContent(supabase, businessId, 4),
  ]);

  return {
    snapshot,
    deltas,
    growth,
    topCustomers,
    upcoming,
    activity,
    topContent,
  };
}

/**
 * Cached marketing overview data (KPIs, charts, top lists, activity).
 * Tenant-scoped via explicit `business_id` filters + service-role reads.
 * Notifications are loaded separately so they stay fresher.
 */
export function loadCachedMarketingDashboard(
  businessId: string,
): Promise<MarketingDashboardSnapshot> {
  return unstable_cache(
    () => fetchMarketingDashboardSnapshot(businessId),
    ["marketing-dashboard-snapshot", businessId],
    {
      revalidate: MARKETING_DASHBOARD_REVALIDATE_SECONDS,
      tags: [`marketing-dashboard:${businessId}`],
    },
  )();
}
