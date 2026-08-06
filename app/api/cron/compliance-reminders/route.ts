import { NextResponse } from "next/server";
import { getRequestId, requireCronAuth } from "@/lib/api/require-cron";
import { ok } from "@/lib/api/response";
import { syncComplianceInAppAlerts } from "@/lib/admin/compliance-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const denied = requireCronAuth(request, requestId);
  if (denied) return denied;

  try {
    const result = await syncComplianceInAppAlerts();
    return ok(result, { requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
