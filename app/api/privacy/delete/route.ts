import { ZodError } from "zod";

import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
  unprocessable,
} from "@/lib/api/response";
import { consume, rateLimitHeaders } from "@/lib/api/rate-limit";
import { tooManyRequests } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/privacy/catalog";
import {
  cancelDeleteSchema,
  requestDeleteSchema,
} from "@/lib/privacy/schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * POST /api/privacy/delete
 *
 * Schedules a soft-delete with a 30-day grace period. The actual record
 * removal is performed by `privacy_execute_pending_deletions()` (called
 * by /api/cron/privacy-sweep), so the user can cancel at any point
 * before the scheduled date.
 *
 * Two scopes:
 *   - "user"     — closes only the calling user's account. Allowed for
 *                  any role; the owner cannot use this and is force-
 *                  upgraded to "business" since their identity *is* the
 *                  business.
 *   - "business" — closes the entire tenant. Owner only.
 *
 * The user must explicitly type the confirmation phrase "DELETE" in the
 * request body to prove intent (this gates the destructive action).
 *
 * DELETE /api/privacy/delete  ⇢ cancels a pending deletion.
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

  // Block while impersonated — destructive actions must come from the
  // real user, never from a platform admin pretending to be them.
  if (user.impersonatedBy) {
    return forbidden(
      "Account deletion cannot be triggered from an impersonation session.",
      { requestId },
    );
  }

  const rl = consume({
    bucket: "privacy.delete",
    identifier: `user:${user.id}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return tooManyRequests(rl.retryAfterSeconds, {
      requestId,
      headers: rateLimitHeaders(rl),
    });
  }

  let parsed: { scope: "user" | "business"; confirmation: "DELETE"; reason?: string };
  try {
    parsed = requestDeleteSchema.parse(await request.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return unprocessable("Invalid request body.", e.issues, { requestId });
    }
    return badRequest("Invalid JSON body.", undefined, { requestId });
  }

  if (parsed.scope === "business" && user.role !== "owner") {
    return forbidden(
      "Only the business owner can close the entire tenant. Use scope='user' to close your own account.",
      { requestId },
    );
  }

  const admin = createServiceRoleClient();
  const now = new Date();
  const scheduledFor = new Date(
    now.getTime() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
  );

  // Reject if there's already a pending deletion of the same scope.
  const dsrKind = parsed.scope === "business" ? "delete_business" : "delete_user";
  const { data: existing } = await admin
    .from("data_subject_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", dsrKind)
    .eq("status", "awaiting_grace")
    .maybeSingle();
  if (existing) {
    return conflict(
      "A deletion of this scope is already scheduled. Cancel it first before requesting a new one.",
      { existingRequestId: existing.id },
      { requestId },
    );
  }

  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = request.headers.get("user-agent") || null;

  const { data: dsr, error: dsrError } = await admin
    .from("data_subject_requests")
    .insert({
      business_id: user.businessId,
      user_id: user.id,
      kind: dsrKind,
      status: "awaiting_grace",
      reason: parsed.reason ?? null,
      scheduled_for: scheduledFor.toISOString(),
      source_ip: sourceIp,
      user_agent: userAgent,
    })
    .select("id, scheduled_for")
    .single();

  if (dsrError || !dsr) {
    logger.error("privacy.delete.dsr_insert_failed", {
      requestId,
      userId: user.id,
      error: dsrError?.message,
    });
    return serverError(requestId, "Could not schedule deletion.");
  }

  // Mark the soft-delete on the principal row (so the UI can banner the
  // user immediately, even before the sweep runs).
  if (parsed.scope === "business") {
    await admin
      .from("businesses")
      .update({
        deletion_requested_at: now.toISOString(),
        deletion_scheduled_for: scheduledFor.toISOString(),
      })
      .eq("id", user.businessId);
  } else {
    await admin
      .from("users")
      .update({
        deletion_requested_at: now.toISOString(),
        deletion_scheduled_for: scheduledFor.toISOString(),
      })
      .eq("id", user.id);
  }

  await admin.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action:
      parsed.scope === "business"
        ? "privacy.business_deletion_scheduled"
        : "privacy.user_deletion_scheduled",
    entity_type: parsed.scope === "business" ? "business" : "user",
    entity_id: parsed.scope === "business" ? user.businessId : user.id,
    diff: { scheduled_for: scheduledFor.toISOString() },
  });

  return ok(
    {
      requestId: dsr.id,
      scope: parsed.scope,
      scheduledFor: dsr.scheduled_for,
      graceDays: ACCOUNT_DELETION_GRACE_DAYS,
    },
    { requestId, headers: rateLimitHeaders(rl) },
  );
}

export async function DELETE(request: Request) {
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

  let parsed: { request_id: string };
  try {
    parsed = cancelDeleteSchema.parse(await request.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return unprocessable("Invalid request body.", e.issues, { requestId });
    }
    return badRequest("Invalid JSON body.", undefined, { requestId });
  }

  const admin = createServiceRoleClient();
  const { data: dsr, error: loadErr } = await admin
    .from("data_subject_requests")
    .select("id, kind, status, user_id, business_id")
    .eq("id", parsed.request_id)
    .maybeSingle();
  if (loadErr) {
    return serverError(requestId, "Could not load request.");
  }
  if (!dsr) return notFound("Request not found.", { requestId });
  if (dsr.user_id !== user.id) {
    return forbidden("You can only cancel your own requests.", { requestId });
  }
  if (dsr.status !== "awaiting_grace") {
    return conflict(
      "Only requests still awaiting grace can be cancelled.",
      { status: dsr.status },
      { requestId },
    );
  }

  await admin
    .from("data_subject_requests")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "user_cancelled",
    })
    .eq("id", dsr.id);

  if (dsr.kind === "delete_business") {
    await admin
      .from("businesses")
      .update({
        deletion_requested_at: null,
        deletion_scheduled_for: null,
      })
      .eq("id", dsr.business_id);
  } else if (dsr.kind === "delete_user") {
    await admin
      .from("users")
      .update({
        deletion_requested_at: null,
        deletion_scheduled_for: null,
      })
      .eq("id", dsr.user_id);
  }

  await admin.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "privacy.deletion_cancelled",
    entity_type: "data_subject_request",
    entity_id: dsr.id,
    diff: { kind: dsr.kind },
  });

  return ok({ requestId: dsr.id, status: "cancelled" }, { requestId });
}
