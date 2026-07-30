import "server-only";

import { loadActiveAiAgentSlugs } from "@/lib/ai/boardroom";
import { malaysiaTodayIso } from "@/lib/ai/hr-assistant-tools";
import { buildLiveAgentNotice } from "@/lib/agent-notices/builders";
import { resolveDailyNoticeAgents } from "@/lib/agent-notices/resolve-enabled";
import type { Role } from "@/lib/permissions";
import { TENANT_AI_AGENTS } from "@/lib/settings/ai-agents-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface HomeAgentNotice {
  agentSlug: string;
  assistantName: string;
  assistantHref: string;
  title: string;
  body: string;
}

export async function loadTodayHomeAgentNotices(
  businessId: string,
  userId: string,
  role: Role,
): Promise<HomeAgentNotice[]> {
  const supabase = await createSupabaseServerClient();
  const noticeDate = malaysiaTodayIso();

  const [activeAddonSlugs, settingsRes] = await Promise.all([
    loadActiveAiAgentSlugs(businessId, supabase),
    supabase
      .from("business_agent_settings")
      .select("agent_slug, display_name, daily_notice_enabled")
      .eq("business_id", businessId),
  ]);

  if (settingsRes.error) {
    throw new Error(settingsRes.error.message);
  }

  const settingsBySlug = new Map(
    (settingsRes.data ?? []).map((row) => [row.agent_slug, row]),
  );

  const enabledAgents = resolveDailyNoticeAgents(
    TENANT_AI_AGENTS,
    activeAddonSlugs,
    settingsBySlug,
  );

  if (enabledAgents.length === 0) {
    return [];
  }

  const enabledSlugs = enabledAgents.map((agent) => agent.agentSlug);

  const { data: storedNotices, error: noticesError } = await supabase
    .from("agent_daily_notices")
    .select("agent_slug, title, body")
    .eq("business_id", businessId)
    .eq("notice_date", noticeDate)
    .in("agent_slug", enabledSlugs);

  if (noticesError) {
    throw new Error(noticesError.message);
  }

  const storedBySlug = new Map(
    (storedNotices ?? []).map((notice) => [notice.agent_slug, notice]),
  );

  const ctx = {
    businessId,
    userId,
    role,
    impersonated: false,
  };

  const order = new Map(
    TENANT_AI_AGENTS.map((agent, index) => [agent.slug, index]),
  );

  const results: HomeAgentNotice[] = [];

  for (const agent of enabledAgents) {
    const def = TENANT_AI_AGENTS.find((a) => a.slug === agent.agentSlug);
    if (!def) {
      continue;
    }

    const stored = storedBySlug.get(agent.agentSlug);

    if (stored) {
      results.push({
        agentSlug: agent.agentSlug,
        assistantName: agent.displayName,
        assistantHref: agent.assistantHref,
        title: stored.title,
        body: stored.body,
      });
      continue;
    }

    try {
      const live = await buildLiveAgentNotice(def, ctx, agent.displayName);
      if (!live) {
        continue;
      }
      results.push({
        agentSlug: agent.agentSlug,
        assistantName: agent.displayName,
        assistantHref: agent.assistantHref,
        title: live.title,
        body: live.body,
      });
    } catch {
      // Skip agents we cannot snapshot (e.g. missing tables in demo).
    }
  }

  return results.sort(
    (a, b) =>
      (order.get(a.agentSlug as (typeof TENANT_AI_AGENTS)[number]["slug"]) ??
        99) -
      (order.get(b.agentSlug as (typeof TENANT_AI_AGENTS)[number]["slug"]) ??
        99),
  );
}
