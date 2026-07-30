import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildPillarDailyNotice } from "@/lib/ai/pillar-daily-notice";
import type { AgentContext, PillarSnapshot } from "@/lib/ai/context/types";
import { malaysiaTodayIso } from "@/lib/ai/hr-assistant-tools";
import { logger } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

interface RunAgentDailyNoticeCronOptions {
  addonSlug: string;
  agentSlug: string;
  defaultDisplayName: string;
  pillarLabel: string;
  emptyMessage: string;
  calmMessage: string;
  logKey: string;
  buildSnapshot: (
    ctx: AgentContext,
    client: SupabaseClient,
  ) => Promise<PillarSnapshot>;
}

export async function runAgentDailyNoticeCron(
  options: RunAgentDailyNoticeCronOptions,
  requestId: string,
): Promise<{ written: number; notice_date: string }> {
  const admin = createServiceRoleClient();
  const noticeDate = malaysiaTodayIso();
  let written = 0;

  const { data: addons, error } = await admin
    .from("business_addons")
    .select("business_id, marketplace_addons!inner(slug)")
    .eq("status", "active")
    .eq("marketplace_addons.slug", options.addonSlug);

  if (error) {
    logger.error(`${options.logKey}.load_failed`, {
      error: error.message,
      requestId,
    });
    throw new Error(error.message);
  }

  for (const row of addons ?? []) {
    const businessId = row.business_id as string;

    const { data: settings } = await admin
      .from("business_agent_settings")
      .select("display_name, daily_notice_enabled")
      .eq("business_id", businessId)
      .eq("agent_slug", options.agentSlug)
      .maybeSingle();

    if (settings && !settings.daily_notice_enabled) {
      continue;
    }

    const { data: owner } = await admin
      .from("users")
      .select("id")
      .eq("business_id", businessId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (!owner) {
      continue;
    }

    const displayName = settings?.display_name ?? options.defaultDisplayName;

    try {
      const ctx: AgentContext = {
        businessId,
        userId: owner.id,
        role: "owner",
        impersonated: false,
      };
      const snapshot = await options.buildSnapshot(ctx, admin);
      const notice = buildPillarDailyNotice(
        snapshot,
        displayName,
        options.pillarLabel,
        options.emptyMessage,
        options.calmMessage,
      );

      const { error: upsertError } = await admin
        .from("agent_daily_notices")
        .upsert(
          {
            business_id: businessId,
            agent_slug: options.agentSlug,
            notice_date: noticeDate,
            title: notice.title,
            body: notice.body,
          },
          { onConflict: "business_id,agent_slug,notice_date" },
        );

      if (upsertError) {
        logger.warn(`${options.logKey}.upsert_failed`, {
          businessId,
          error: upsertError.message,
        });
        continue;
      }
      written += 1;
    } catch (err) {
      logger.warn(`${options.logKey}.business_failed`, {
        businessId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { written, notice_date: noticeDate };
}
