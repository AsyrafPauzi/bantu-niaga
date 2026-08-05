import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationPillar } from "@/lib/notifications/post";

export interface PillarNotificationItem {
  id: string;
  message: string;
  event_type: string;
  created_at: string;
}

export async function loadPillarNotifications(
  supabase: SupabaseClient,
  businessId: string,
  pillar: NotificationPillar,
  limit = 12,
): Promise<PillarNotificationItem[]> {
  const { data } = await supabase
    .from("business_notifications")
    .select("id, message, event_type, created_at")
    .eq("business_id", businessId)
    .eq("pillar", pillar)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as PillarNotificationItem[];
}
