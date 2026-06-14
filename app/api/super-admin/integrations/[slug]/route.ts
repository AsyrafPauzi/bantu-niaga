import { ZodError } from "zod";

import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
  unprocessable,
} from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { findIntegration } from "@/lib/integrations/catalog";
import { encryptionConfigured } from "@/lib/integrations/crypto";
import { loadIntegration } from "@/lib/integrations/load";
import { upsertIntegration } from "@/lib/integrations/mutate";
import { integrationUpsertSchema } from "@/lib/integrations/schemas";
import {
  requirePlatformAdmin,
  NotPlatformAdminError,
} from "@/lib/auth/require-platform-admin";

/**
 * GET    /api/super-admin/integrations/[slug]  → load current state (no secrets)
 * PATCH  /api/super-admin/integrations/[slug]  → upsert config + secrets + enabled toggle
 *
 * Platform-admin only. Mutations are audited via super_admin_audit.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireAdmin(requestId: string) {
  try {
    return await requirePlatformAdmin();
  } catch (e) {
    if (e instanceof NotPlatformAdminError) {
      return unauthorized("Platform admin only.", { requestId });
    }
    throw e;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const admin = await requireAdmin(requestId);
  if (!("userId" in admin)) return admin;

  const { slug } = await context.params;
  const loaded = await loadIntegration(slug);
  if (!loaded) return notFound("Integration not found.", { requestId });

  return ok(
    {
      descriptor: loaded.descriptor,
      row: loaded.row,
      encryptionConfigured: encryptionConfigured(),
    },
    { requestId },
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const admin = await requireAdmin(requestId);
  if (!("userId" in admin)) return admin;

  const { slug } = await context.params;
  const descriptor = findIntegration(slug);
  if (!descriptor) return notFound("Integration not found.", { requestId });

  let body;
  try {
    body = integrationUpsertSchema.parse(await request.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return unprocessable("Invalid request body.", e.issues, { requestId });
    }
    return badRequest("Invalid JSON body.", undefined, { requestId });
  }

  // Validate config keys + secret keys against the descriptor.
  if (body.config) {
    for (const k of Object.keys(body.config)) {
      const f = descriptor.fields.find((x) => x.key === k);
      if (!f) {
        return badRequest(`Unknown config field: ${k}`, undefined, { requestId });
      }
      if (f.type === "secret") {
        return badRequest(
          `Field "${k}" is a secret — send it in "secrets", not "config".`,
          undefined,
          { requestId },
        );
      }
    }
  }
  if (body.secrets) {
    for (const k of Object.keys(body.secrets)) {
      const f = descriptor.fields.find((x) => x.key === k);
      if (!f || f.type !== "secret") {
        return badRequest(`Unknown secret field: ${k}`, undefined, { requestId });
      }
    }
    if (Object.values(body.secrets).some((v) => typeof v === "string" && v.length > 0)) {
      if (!encryptionConfigured()) {
        return forbidden(
          "INTEGRATION_ENCRYPTION_KEY is not set on the server — cannot persist secrets.",
          { requestId },
        );
      }
    }
  }

  try {
    await upsertIntegration({
      slug,
      enabled: body.enabled,
      config: body.config,
      secrets: body.secrets,
      adminUserId: admin.userId,
      adminEmail: admin.email,
    });
  } catch (e) {
    logger.error("integrations.upsert.failed", {
      requestId,
      slug,
      error: e instanceof Error ? e.message : String(e),
    });
    return serverError(requestId, "Could not save integration.");
  }

  const loaded = await loadIntegration(slug);
  return ok({ row: loaded?.row ?? null }, { requestId });
}
