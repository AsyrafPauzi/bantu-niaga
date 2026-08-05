import type { SupabaseClient } from "@supabase/supabase-js";
import { BOARDROOM_HISTORY_LIMIT } from "@/lib/ai/boardroom-shared";

/** Delete oldest ended meetings when count exceeds BOARDROOM_HISTORY_LIMIT. */
export async function trimBoardroomMeetingHistory(
  supabase: SupabaseClient,
  businessId: string,
): Promise<void> {
  const { data: ended } = await supabase
    .from("boardroom_meetings")
    .select("id")
    .eq("business_id", businessId)
    .eq("status", "ended")
    .order("ended_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!ended || ended.length <= BOARDROOM_HISTORY_LIMIT) return;

  const staleIds = ended.slice(BOARDROOM_HISTORY_LIMIT).map((row) => row.id);
  if (staleIds.length === 0) return;

  await supabase
    .from("boardroom_meetings")
    .delete()
    .eq("business_id", businessId)
    .in("id", staleIds);
}
