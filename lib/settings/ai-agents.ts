import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BOARDROOM_MIN_AGENTS } from "@/lib/ai/boardroom-shared";
import { loadActiveAiAgentSlugs } from "@/lib/ai/boardroom";
import { getCreditBalance, hasActiveAddon } from "@/lib/marketplace/entitlements";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  TENANT_AI_AGENTS,
  type AgentListItem,
  type AgentSlug,
  normalizeReasoningMode,
  type AgentsOverview,
} from "@/lib/settings/ai-agents-catalog";
import {
  clampDailyBudgetCredits,
  creditsToMyr,
  DAILY_BUDGET_DEFAULT_CREDITS,
  monthlyBundledCredits,
  myrToCredits,
} from "@/lib/settings/credit-pricing";

export type { AgentListItem, AgentsOverview };

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getAgentCreditsSpentToday(
  businessId: string,
  agentSlug: string,
  client?: SupabaseClient,
): Promise<number> {
  const supabase = client ?? (await createSupabaseServerClient());
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("ai_usage")
    .select("credits_charged")
    .eq("business_id", businessId)
    .eq("agent_slug", agentSlug)
    .gte("created_at", todayStart.toISOString());

  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + (row.credits_charged ?? 0), 0);
}

export const loadAgentsOverview = cache(
  async (businessId: string): Promise<AgentsOverview> => {
    const supabase = await createSupabaseServerClient();
    const monthStart = startOfMonthIso();
    const todayStart = startOfTodayIso();

    const [settingsRes, usageMonthRes, usageTodayRes, balance, activeAddonSlugs] =
      await Promise.all([
        supabase
          .from("business_agent_settings")
          .select(
            "agent_slug, display_name, assistant_enabled, daily_notice_enabled, reasoning_mode, daily_budget_myr",
          )
          .eq("business_id", businessId),
        supabase
          .from("ai_usage")
          .select("agent_slug, credits_charged, cost_myr_estimated")
          .eq("business_id", businessId)
          .gte("created_at", monthStart),
        supabase
          .from("ai_usage")
          .select("agent_slug, credits_charged, cost_myr_estimated")
          .eq("business_id", businessId)
          .gte("created_at", todayStart),
        getCreditBalance(businessId),
        loadActiveAiAgentSlugs(businessId, supabase),
      ]);

    if (settingsRes.error) throw new Error(settingsRes.error.message);

    const settingsBySlug = new Map(
      (settingsRes.data ?? []).map((row) => [row.agent_slug, row]),
    );

    const usageMonth = new Map<string, { credits: number; spent: number }>();
    for (const row of usageMonthRes.data ?? []) {
      const cur = usageMonth.get(row.agent_slug) ?? { credits: 0, spent: 0 };
      cur.credits += row.credits_charged ?? 0;
      cur.spent += Number(row.cost_myr_estimated ?? 0);
      usageMonth.set(row.agent_slug, cur);
    }

    const usageToday = new Map<string, number>();
    for (const row of usageTodayRes.data ?? []) {
      usageToday.set(
        row.agent_slug,
        (usageToday.get(row.agent_slug) ?? 0) + (row.credits_charged ?? 0),
      );
    }

    const moduleAgentsActive = TENANT_AI_AGENTS.filter(
      (a) => a.slug !== "boardroom" && a.addonSlug,
    ).filter((a) => activeAddonSlugs.has(a.addonSlug!)).length;

    const boardroomAddon = await hasActiveAddon(businessId, "boardroom-weekly");
    const boardroomUnlockedGlobal =
      boardroomAddon || moduleAgentsActive >= BOARDROOM_MIN_AGENTS;

    const agents: AgentListItem[] = await Promise.all(
      TENANT_AI_AGENTS.map(async (def) => {
        const stored = settingsBySlug.get(def.slug);
        const addonActive =
          def.slug === "boardroom"
            ? boardroomUnlockedGlobal
            : def.addonSlug
              ? activeAddonSlugs.has(def.addonSlug)
              : false;

        const month = usageMonth.get(def.slug);
        const spentTodayCredits = usageToday.get(def.slug) ?? 0;
        const budgetCredits = clampDailyBudgetCredits(
          myrToCredits(Number(stored?.daily_budget_myr ?? creditsToMyr(DAILY_BUDGET_DEFAULT_CREDITS))),
        );

        return {
          slug: def.slug,
          display_name: stored?.display_name ?? def.defaultName,
          assistant_enabled: stored?.assistant_enabled ?? addonActive,
          daily_notice_enabled:
            stored?.daily_notice_enabled ??
            (def.slug === "hr" && addonActive),
          reasoning_mode: normalizeReasoningMode(stored?.reasoning_mode),
          daily_budget_myr: creditsToMyr(budgetCredits),
          daily_budget_credits: budgetCredits,
          addon_active: addonActive,
          boardroom_unlocked: boardroomUnlockedGlobal,
          credits_used_month: month?.credits ?? 0,
          spent_today_credits: spentTodayCredits,
          spent_today_myr: creditsToMyr(spentTodayCredits),
        };
      }),
    );

    const activeCount = agents.filter(
      (a) => a.addon_active && a.assistant_enabled,
    ).length;

    const creditsUsedMonth = agents.reduce(
      (sum, agent) => sum + agent.credits_used_month,
      0,
    );

    return {
      agents,
      credit_balance: balance,
      active_count: activeCount,
      subscribed_agent_count: moduleAgentsActive,
      monthly_bundled_credits: monthlyBundledCredits(moduleAgentsActive),
      credits_used_month: creditsUsedMonth,
      total_spent_today_credits: agents.reduce(
        (n, a) => n + a.spent_today_credits,
        0,
      ),
      total_spent_today_myr: agents.reduce(
        (n, a) => n + a.spent_today_myr,
        0,
      ),
      total_daily_budget_credits: agents
        .filter((a) => a.addon_active)
        .reduce((n, a) => n + a.daily_budget_credits, 0),
      total_daily_budget_myr: agents
        .filter((a) => a.addon_active)
        .reduce((n, a) => n + a.daily_budget_myr, 0),
      boardroom_unlocked:
        agents.find((a) => a.slug === "boardroom")?.boardroom_unlocked ?? false,
    };
  },
);
