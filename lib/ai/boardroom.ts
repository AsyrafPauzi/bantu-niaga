import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadEntitledAgentSlugs } from "@/lib/marketplace/plan-agent-entitlements";
import type { TierKey } from "@/lib/settings/plans";
import {
  AI_AGENT_ADDON_SLUGS,
  BOARDROOM_AGENTS,
  BOARDROOM_MIN_AGENTS,
  type BoardroomStatus,
} from "@/lib/ai/boardroom-shared";
import { tierAllowsBoardroom } from "@/lib/settings/tier-agents";
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
  const { data: biz, error: bizError } = await supabase
    .from("businesses")
    .select("tier")
    .eq("id", businessId)
    .single();

  if (bizError) {
    throw new Error(bizError.message);
  }

  const tier = (biz?.tier as TierKey) ?? "starter";
  return loadEntitledAgentSlugs(businessId, tier, supabase);
}

export async function loadBoardroomStatus(
  businessId: string,
): Promise<BoardroomStatus> {
  const supabase = await createSupabaseServerClient();
  const { data: biz, error: bizError } = await supabase
    .from("businesses")
    .select("tier")
    .eq("id", businessId)
    .single();

  if (bizError) {
    throw new Error(bizError.message);
  }

  const tier = (biz?.tier as TierKey) ?? "starter";
  const boardroomAllowed = tierAllowsBoardroom(tier);

  const [activeSlugs, settingsRes] = await Promise.all([
    loadActiveAiAgentSlugs(businessId, supabase),
    supabase
      .from("business_agent_settings")
      .select("agent_slug, display_name, assistant_enabled")
      .eq("business_id", businessId),
  ]);

  if (settingsRes.error) {
    throw new Error(settingsRes.error.message);
  }

  const settingsBySlug = new Map(
    (settingsRes.data ?? []).map((row) => [row.agent_slug, row]),
  );

  const agents = BOARDROOM_AGENTS.map((agent) => {
    const stored = settingsBySlug.get(agent.id);
    const subscribed = activeSlugs.has(agent.addonSlug);
    const assistantOn = stored?.assistant_enabled ?? subscribed;
    const label = stored?.display_name?.trim() || agent.label;
    return {
      ...agent,
      label,
      subscribed,
      live: boardroomAllowed && subscribed && assistantOn,
    };
  });
  const activeCount = agents.filter((a) => a.live).length;
  return {
    agents,
    activeCount,
    unlocked: boardroomAllowed && activeCount >= BOARDROOM_MIN_AGENTS,
  };
}
