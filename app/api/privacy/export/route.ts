import { ZodError } from "zod";

import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { consume, rateLimitHeaders } from "@/lib/api/rate-limit";
import {
  created,
  serverError,
  tooManyRequests,
  unauthorized,
  unprocessable,
} from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { buildExportBundle } from "@/lib/privacy/load";
import { requestExportSchema } from "@/lib/privacy/schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * POST /api/privacy/export
 *
 * Right-to-access + portability. Builds a machine-readable JSON bundle
 * containing every personal-data field we hold for the calling user,
 * stores it in `data_exports` (auto-expires after 7 days), and returns
 * the export id + a `download` URL.
 *
 * Heavy operation — rate-limited to 3 requests / hour / user.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
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

  const rl = consume({
    bucket: "privacy.export",
    identifier: `user:${user.id}`,
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return tooManyRequests(rl.retryAfterSeconds, {
      requestId,
      headers: rateLimitHeaders(rl),
    });
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    /* empty body is fine */
  }

  let parsed: { reason?: string };
  try {
    parsed = requestExportSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return unprocessable("Invalid request body.", e.issues, { requestId });
    }
    throw e;
  }

  const admin = createServiceRoleClient();
  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = request.headers.get("user-agent") || null;

  // 1. Record the DSR row (status=in_progress).
  const { data: dsr, error: dsrError } = await admin
    .from("data_subject_requests")
    .insert({
      business_id: user.businessId,
      user_id: user.id,
      kind: "export",
      status: "in_progress",
      reason: parsed.reason ?? null,
      source_ip: sourceIp,
      user_agent: userAgent,
    })
    .select("id")
    .single();

  if (dsrError || !dsr) {
    logger.error("privacy.export.dsr_insert_failed", {
      requestId,
      userId: user.id,
      error: dsrError?.message,
    });
    return serverError(requestId, "Could not record export request.");
  }

  // 2. Build the bundle.
  let bundle: { payload: Record<string, unknown>; byteSize: number };
  try {
    bundle = await buildExportBundle({
      userId: user.id,
      businessId: user.businessId,
    });
  } catch (e) {
    await admin
      .from("data_subject_requests")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", dsr.id);
    logger.error("privacy.export.build_failed", {
      requestId,
      userId: user.id,
      error: e instanceof Error ? e.message : String(e),
    });
    return serverError(requestId, "Could not generate export bundle.");
  }

  // 3. Persist as data_exports row (7-day expiry handled by column default).
  const { data: exp, error: expErr } = await admin
    .from("data_exports")
    .insert({
      business_id: user.businessId,
      user_id: user.id,
      request_id: dsr.id,
      payload: bundle.payload,
      byte_size: bundle.byteSize,
    })
    .select("id, expires_at")
    .single();

  if (expErr || !exp) {
    await admin
      .from("data_subject_requests")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", dsr.id);
    logger.error("privacy.export.persist_failed", {
      requestId,
      userId: user.id,
      error: expErr?.message,
    });
    return serverError(requestId, "Could not persist export bundle.");
  }

  // 4. Close the DSR.
  await admin
    .from("data_subject_requests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      payload: { export_id: exp.id, byte_size: bundle.byteSize },
    })
    .eq("id", dsr.id);

  await admin.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "privacy.export.created",
    entity_type: "data_export",
    entity_id: exp.id,
    diff: { byte_size: bundle.byteSize },
  });

  return created(
    {
      requestId: dsr.id,
      exportId: exp.id,
      byteSize: bundle.byteSize,
      expiresAt: exp.expires_at,
      downloadUrl: `/api/privacy/export/${exp.id}`,
    },
    { requestId, headers: rateLimitHeaders(rl) },
  );
}
