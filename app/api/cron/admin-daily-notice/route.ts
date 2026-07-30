import { NextResponse } from "next/server";

import { ok, unauthorized } from "@/lib/api/response";
import { buildAdminSnapshot } from "@/lib/ai/context/admin";
import { runAgentDailyNoticeCron } from "@/lib/ai/run-agent-daily-notice-cron";
import {
  ADMIN_AGENT_SLUG,
  ADMIN_ASSISTANT_ADDON_SLUG,
} from "@/lib/marketplace/agent-types";

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

  try {
    const result = await runAgentDailyNoticeCron(
      {
        addonSlug: ADMIN_ASSISTANT_ADDON_SLUG,
        agentSlug: ADMIN_AGENT_SLUG,
        defaultDisplayName: "Amir",
        pillarLabel: "Admin",
        emptyMessage:
          "No admin activity yet — your business overview will appear here.",
        calmMessage:
          "• No urgent Admin items today — compliance and tasks look up to date.",
        logKey: "admin.notice.cron",
        buildSnapshot: buildAdminSnapshot,
      },
      requestId,
    );
    return ok(result, { requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
