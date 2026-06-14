import { NextResponse } from "next/server";

import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { notFound, unauthorized } from "@/lib/api/response";
import { loadExportPayload, loadExportSummary } from "@/lib/privacy/load";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * GET /api/privacy/export/[id]
 *
 * Downloads a previously generated export bundle. Validates ownership
 * (the user can only download their own exports), checks expiry, and
 * streams the JSON with a `Content-Disposition: attachment` header so
 * browsers save it as a file.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();

  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return unauthorized("Authentication required.", { requestId });
    }
    throw e;
  }

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return notFound("Export not found.", { requestId });
  }

  const summary = await loadExportSummary(id, user.id);
  if (!summary) return notFound("Export not found or expired.", { requestId });

  const payload = await loadExportPayload(id, user.id);
  if (!payload) return notFound("Export expired.", { requestId });

  // Record the download so we can prove the user actually received the
  // bundle (s.7 — security; chain-of-custody for DSR).
  const admin = createServiceRoleClient();
  await admin.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "privacy.export.downloaded",
    entity_type: "data_export",
    entity_id: id,
    diff: null,
  });

  const filename = `bantuniaga-data-export-${id}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Request-Id": requestId,
    },
  });
}
