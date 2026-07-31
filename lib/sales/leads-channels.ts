import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { LEAD_CHANNELS } from "@/lib/sales/schemas";

export type ChannelCount = { channel: string; count: number };

export async function loadLeadChannelBreakdown(
  supabase: SupabaseClient,
  businessId: string,
): Promise<ChannelCount[]> {
  const { data, error } = await supabase
    .from("sales_leads")
    .select("channel")
    .eq("business_id", businessId)
    .not("status", "in", "(won,lost)")
    .not("channel", "is", null);

  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const ch of LEAD_CHANNELS) counts.set(ch, 0);
  for (const row of data ?? []) {
    const ch = row.channel as string;
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([channel, count]) => ({ channel, count }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
}
