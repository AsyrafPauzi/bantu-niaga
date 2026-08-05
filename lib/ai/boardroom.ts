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
  const supabase = await createSupabaseServerClient();
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
      live: subscribed && assistantOn,
    };
  });
  const activeCount = agents.filter((a) => a.live).length;
  return {
    agents,
    activeCount,
    unlocked: activeCount >= BOARDROOM_MIN_AGENTS,
  };
}
