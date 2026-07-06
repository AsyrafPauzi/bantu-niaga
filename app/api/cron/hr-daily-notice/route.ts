import { NextResponse } from "next/server";

import { ok, unauthorized } from "@/lib/api/response";
import { buildHrSnapshot } from "@/lib/ai/context/hr";
import { buildHrDailyNotice } from "@/lib/ai/hr-daily-notice";
import { malaysiaTodayIso } from "@/lib/ai/hr-assistant-tools";
import { HR_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { logger } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return unauthorized("CRON_SECRET is not configured.", { requestId });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized("Invalid cron credentials.", { requestId });
  }

  const admin = createServiceRoleClient();
  const noticeDate = malaysiaTodayIso();
  let written = 0;

  const { data: addons, error } = await admin
    .from("business_addons")
    .select("business_id, marketplace_addons!inner(slug)")
    .eq("status", "active")
    .eq("marketplace_addons.slug", "hr-assistant");

  if (error) {
    logger.error("hr.notice.cron.load_failed", { error: error.message, requestId });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  for (const row of addons ?? []) {
    const businessId = row.business_id as string;

    const { data: settings } = await admin
      .from("business_agent_settings")
      .select("display_name, daily_notice_enabled")
      .eq("business_id", businessId)
      .eq("agent_slug", HR_AGENT_SLUG)
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

    const displayName = settings?.display_name ?? "Hana";

    try {
      const snapshot = await buildHrSnapshot(
        {
          businessId,
          userId: owner.id,
          role: "owner",
          impersonated: false,
        },
        admin,
      );

      const notice = buildHrDailyNotice(snapshot, displayName);

      const { error: upsertError } = await admin
        .from("agent_daily_notices")
        .upsert(
          {
            business_id: businessId,
            agent_slug: HR_AGENT_SLUG,
            notice_date: noticeDate,
            title: notice.title,
            body: notice.body,
          },
          { onConflict: "business_id,agent_slug,notice_date" },
        );

      if (upsertError) {
        logger.warn("hr.notice.cron.upsert_failed", {
          businessId,
          error: upsertError.message,
        });
        continue;
      }
      written += 1;
    } catch (e) {
      logger.warn("hr.notice.cron.tenant_failed", {
        businessId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  logger.info("hr.notice.cron.completed", { requestId, written });
  return ok({ written, notice_date: noticeDate }, { requestId });
}
