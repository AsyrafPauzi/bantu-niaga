import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api/db-error";
import { getRequestId, requireCronAuth } from "@/lib/api/require-cron";

import { ok } from "@/lib/api/response";
import { buildMarketingSnapshot } from "@/lib/ai/context/marketing";
import { buildMarketingDailyNotice } from "@/lib/ai/marketing-daily-notice";
import { malaysiaTodayIso } from "@/lib/ai/marketing-assistant-tools";
import { MARKETING_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { logger } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const denied = requireCronAuth(request, requestId);
  if (denied) return denied;

  const admin = createServiceRoleClient();
  const noticeDate = malaysiaTodayIso();
  let written = 0;

  const { data: addons, error } = await admin
    .from("business_addons")
    .select("business_id, marketplace_addons!inner(slug)")
    .eq("status", "active")
    .eq("marketplace_addons.slug", "marketing-assistant");

  if (error) {
    logger.error("marketing.notice.cron.load_failed", {
      error: error.message,
      requestId,
    });
    return dbErrorResponse("rpc_failed", error, "cron.job_failed", { requestId });
  }

  for (const row of addons ?? []) {
    const businessId = row.business_id as string;

    const { data: settings } = await admin
      .from("business_agent_settings")
      .select("display_name, daily_notice_enabled")
      .eq("business_id", businessId)
      .eq("agent_slug", MARKETING_AGENT_SLUG)
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

    const displayName = settings?.display_name ?? "Maya";

    try {
      const snapshot = await buildMarketingSnapshot(
        {
          businessId,
          userId: owner.id,
          role: "owner",
          impersonated: false,
        },
        admin,
      );

      const notice = buildMarketingDailyNotice(snapshot, displayName);

      const { error: upsertError } = await admin
        .from("agent_daily_notices")
        .upsert(
          {
            business_id: businessId,
            agent_slug: MARKETING_AGENT_SLUG,
            notice_date: noticeDate,
            title: notice.title,
            body: notice.body,
          },
          { onConflict: "business_id,agent_slug,notice_date" },
        );

      if (upsertError) {
        logger.warn("marketing.notice.cron.upsert_failed", {
          businessId,
          error: upsertError.message,
        });
        continue;
      }
      written += 1;
    } catch (err) {
      logger.warn("marketing.notice.cron.business_failed", {
        businessId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return ok({ written, notice_date: noticeDate }, { requestId });
}
