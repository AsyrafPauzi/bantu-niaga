import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api/db-error";

import { ok } from "@/lib/api/response";
import { getRequestId, requireCronAuth } from "@/lib/api/require-cron";
import { buildBoardroomWeeklyDigest } from "@/lib/ai/boardroom-weekly-digest";
import { digestEmailChrome } from "@/lib/email/copy";
import { formatPlatformFrom } from "@/lib/email/from";
import { renderNiagaXEmail } from "@/lib/email/layout";
import { parseEmailLocaleHint } from "@/lib/email/resolve-locale";
import { logger } from "@/lib/logger";
import { sendPlatformEmail } from "@/lib/privacy/platform-email";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Sunday cron — emails owners with the Boardroom weekly digest add-on. */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const denied = requireCronAuth(request, requestId);
  if (denied) return denied;

  const apiKey = process.env.RESEND_API_KEY ?? "";
  const fromEmail = process.env.MARKETING_FROM_EMAIL ?? "";

  const admin = createServiceRoleClient();
  let sent = 0;
  let skipped = 0;

  const { data: addons, error } = await admin
    .from("business_addons")
    .select("business_id, marketplace_addons!inner(slug)")
    .eq("status", "active")
    .eq("marketplace_addons.slug", "boardroom-weekly");

  if (error) {
    logger.error("boardroom.digest.cron.load_failed", {
      error: error.message,
      requestId,
    });
    return dbErrorResponse("rpc_failed", error, "cron.job_failed", { requestId });
  }

  for (const row of addons ?? []) {
    const businessId = row.business_id as string;

    const [{ data: business }, { data: owner }] = await Promise.all([
      admin
        .from("businesses")
        .select("id, name")
        .eq("id", businessId)
        .maybeSingle(),
      admin
        .from("users")
        .select("id, email, preferred_locale")
        .eq("business_id", businessId)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle(),
    ]);

    if (!business || !owner?.email) {
      skipped += 1;
      continue;
    }

    try {
      const digest = await buildBoardroomWeeklyDigest(
        businessId,
        owner.id,
        business.name as string,
        admin,
      );

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
      const locale = parseEmailLocaleHint(owner.preferred_locale) ?? "en";
      const chrome = digestEmailChrome(locale);
      const html = renderNiagaXEmail({
        locale,
        brandName: "NiagaX",
        subject: digest.subject,
        heading: digest.subject,
        bodyText: digest.body,
        ctaLabel: chrome.ctaLabel,
        ctaHref: appUrl ? `${appUrl}/boardroom` : undefined,
        footerText: chrome.footerText,
      });

      const result = await sendPlatformEmail({
        userId: owner.id as string,
        category: "product_updates",
        to: owner.email,
        subject: digest.subject,
        body: digest.body,
        html,
        fromEmail: formatPlatformFrom(fromEmail),
        apiKey,
      });

      if (!result.ok) {
        if (result.reason === "consent_denied") {
          logger.info("boardroom.digest.cron.skipped_consent", {
            businessId,
            userId: owner.id,
            consentKind: result.consentKind,
            requestId,
          });
          skipped += 1;
          continue;
        }
        logger.warn("boardroom.digest.cron.send_failed", {
          businessId,
          reason: result.reason,
          requestId,
        });
        skipped += 1;
        continue;
      }

      sent += 1;
    } catch (err) {
      logger.warn("boardroom.digest.cron.business_failed", {
        businessId,
        error: err instanceof Error ? err.message : String(err),
        requestId,
      });
      skipped += 1;
    }
  }

  return ok({ sent, skipped }, { requestId });
}
