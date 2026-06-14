import { ZodError } from "zod";

import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  badRequest,
  forbidden,
  ok,
  serverError,
  unauthorized,
  unprocessable,
} from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { CONSENT_CATALOG } from "@/lib/privacy/catalog";
import { loadConsents } from "@/lib/privacy/load";
import { consentsUpdateSchema } from "@/lib/privacy/schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * GET  /api/privacy/consents — current consent state for the calling user.
 * POST /api/privacy/consents — toggle one or more consents.
 *
 * The required consents (terms_of_service, privacy_notice) cannot be
 * withdrawn via this endpoint — withdrawing them is equivalent to closing
 * the account and must go through /api/privacy/delete.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
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

  const consents = await loadConsents(user.id, user.businessId);
  return ok({ consents }, { requestId });
}

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

  let parsed;
  try {
    parsed = consentsUpdateSchema.parse(await request.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return unprocessable("Invalid request body.", e.issues, { requestId });
    }
    return badRequest("Invalid JSON body.", undefined, { requestId });
  }

  // Block withdrawals of required consents.
  for (const c of parsed.changes) {
    const descriptor = CONSENT_CATALOG.find((d) => d.kind === c.kind);
    if (!descriptor) {
      return badRequest(`Unknown consent kind: ${c.kind}`, undefined, {
        requestId,
      });
    }
    if (descriptor.required && !c.granted) {
      return forbidden(
        `Cannot withdraw the required consent "${descriptor.title}". Close your account instead.`,
        { requestId },
      );
    }
  }

  const admin = createServiceRoleClient();
  const now = new Date().toISOString();
  const policyVersion = process.env.PRIVACY_POLICY_VERSION || "2026-06-14";
  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = request.headers.get("user-agent") || null;

  // Build a single upsert payload — `unique (user_id, kind)` enforces
  // one row per consent kind.
  const rows = parsed.changes.map((c) => ({
    business_id: user.businessId,
    user_id: user.id,
    kind: c.kind,
    granted: c.granted,
    policy_version: policyVersion,
    granted_at: c.granted ? now : null,
    withdrawn_at: c.granted ? null : now,
    source_ip: sourceIp,
    user_agent: userAgent,
  }));

  const { error: upsertErr } = await admin
    .from("user_consents")
    .upsert(rows, { onConflict: "user_id,kind" });

  if (upsertErr) {
    logger.error("privacy.consents.upsert_failed", {
      requestId,
      userId: user.id,
      error: upsertErr.message,
    });
    return serverError(requestId, "Could not update consents.");
  }

  await admin.from("data_subject_requests").insert({
    business_id: user.businessId,
    user_id: user.id,
    kind: "consent_change",
    status: "completed",
    completed_at: now,
    payload: { changes: parsed.changes },
    source_ip: sourceIp,
    user_agent: userAgent,
  });

  await admin.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "privacy.consents.updated",
    entity_type: "user",
    entity_id: user.id,
    diff: { changes: parsed.changes, policy_version: policyVersion },
  });

  const consents = await loadConsents(user.id, user.businessId);
  return ok({ consents }, { requestId });
}
