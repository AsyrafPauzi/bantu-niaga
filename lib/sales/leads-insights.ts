import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { malaysiaDayBounds, malaysiaTodayYmd } from "@/lib/sales/schemas";

export interface LeadsInsights {
  open: number;
  overdue: number;
  dueToday: number;
  won: number;
  lost: number;
  pipelineValueMyr: number;
  topChannel: string | null;
}

export async function loadLeadsInsights(
  supabase: SupabaseClient,
  businessId: string,
): Promise<LeadsInsights> {
  const { dayStartIso, dayEndIso } = malaysiaDayBounds(malaysiaTodayYmd());

  const [openRes, overdueRes, dueTodayRes, wonRes, lostRes, pipelineRes, channelRes] =
    await Promise.all([
      supabase
        .from("sales_leads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .not("status", "in", "(won,lost)"),
      supabase
        .from("sales_leads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .not("follow_up_at", "is", null)
        .lt("follow_up_at", dayStartIso)
        .not("status", "in", "(won,lost)"),
      supabase
        .from("sales_leads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("follow_up_at", dayStartIso)
        .lt("follow_up_at", dayEndIso)
        .not("status", "in", "(won,lost)"),
      supabase
        .from("sales_leads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "won"),
      supabase
        .from("sales_leads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "lost"),
      supabase
        .from("sales_leads")
        .select("estimated_value_myr")
        .eq("business_id", businessId)
        .not("status", "in", "(won,lost)"),
      supabase
        .from("sales_leads")
        .select("channel")
        .eq("business_id", businessId)
        .not("status", "in", "(won,lost)")
        .not("channel", "is", null),
    ]);

  const pipelineValueMyr = (pipelineRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.estimated_value_myr ?? 0),
    0,
  );

  const channelCounts = new Map<string, number>();
  for (const row of channelRes.data ?? []) {
    const ch = row.channel as string;
    channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
  }
  let topChannel: string | null = null;
  let topCount = 0;
  for (const [ch, count] of channelCounts) {
    if (count > topCount) {
      topChannel = ch;
      topCount = count;
    }
  }

  return {
    open: openRes.count ?? 0,
    overdue: overdueRes.count ?? 0,
    dueToday: dueTodayRes.count ?? 0,
    won: wonRes.count ?? 0,
    lost: lostRes.count ?? 0,
    pipelineValueMyr,
    topChannel,
  };
}
