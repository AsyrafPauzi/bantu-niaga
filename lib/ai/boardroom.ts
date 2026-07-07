import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AI_AGENT_ADDON_SLUGS,
  BOARDROOM_AGENTS,
  BOARDROOM_MIN_AGENTS,
  type BoardroomStatus,
} from "@/lib/ai/boardroom-shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export {
  AI_AGENT_ADDON_SLUGS,
  BOARDROOM_AGENTS,
  BOARDROOM_MIN_AGENTS,
  type BoardroomAgentId,
  type BoardroomAgentMeta,
  type BoardroomAgentState,
  type BoardroomStatus,
} from "@/lib/ai/boardroom-shared";

export async function loadActiveAiAgentSlugs(
  businessId: string,
  client?: SupabaseClient,
): Promise<Set<string>> {
  const supabase = client ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("business_addons")
    .select("marketplace_addons!inner(slug)")
    .eq("business_id", businessId)
    .eq("status", "active")
    .in("marketplace_addons.slug", [...AI_AGENT_ADDON_SLUGS]);

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    (data ?? []).map((row) => {
      const addon = row.marketplace_addons as unknown as { slug: string };
      return addon.slug;
    }),
  );
}

export async function loadBoardroomStatus(
  businessId: string,
): Promise<BoardroomStatus> {
  const activeSlugs = await loadActiveAiAgentSlugs(businessId);
  const agents = BOARDROOM_AGENTS.map((agent) => ({
    ...agent,
    live: activeSlugs.has(agent.addonSlug),
  }));
  const activeCount = agents.filter((a) => a.live).length;
  return {
    agents,
    activeCount,
    unlocked: activeCount >= BOARDROOM_MIN_AGENTS,
  };
}
