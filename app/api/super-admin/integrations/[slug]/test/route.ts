import { notFound, ok, unauthorized } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { findIntegration } from "@/lib/integrations/catalog";
import { recordTestResult } from "@/lib/integrations/mutate";
import { runIntegrationTest } from "@/lib/integrations/testers";
import {
  requirePlatformAdmin,
  NotPlatformAdminError,
} from "@/lib/auth/require-platform-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * POST /api/super-admin/integrations/[slug]/test
 *
 * Runs the per-integration smoke test (see lib/integrations/testers.ts),
 * stores the outcome on the row, and audits the action.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SealedEnvelope {
  fields?: Record<
    string,
    { v: 1; alg: "aes-256-gcm"; iv: string; ct: string; tag: string }
  >;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();

  let admin;
  try {
    admin = await requirePlatformAdmin();
  } catch (e) {
    if (e instanceof NotPlatformAdminError) {
      return unauthorized("Platform admin only.", { requestId });
    }
    throw e;
  }

  const { slug } = await context.params;
  const descriptor = findIntegration(slug);
  if (!descriptor) return notFound("Integration not found.", { requestId });

  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("platform_integrations")
    .select("config, encrypted_credentials")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) {
    return ok(
      { ok: false, message: "No credentials saved yet." },
      { requestId },
    );
  }

  const result = await runIntegrationTest({
    slug,
    config: ((data as { config?: Record<string, unknown> }).config) ?? {},
    encryptedFields:
      ((data as { encrypted_credentials?: SealedEnvelope })
        .encrypted_credentials?.fields) ?? null,
  });

  try {
    await recordTestResult({
      slug,
      ok: result.ok,
      error: result.message,
      adminUserId: admin.userId,
      adminEmail: admin.email,
    });
  } catch (e) {
    logger.warn("integrations.test.record_failed", {
      requestId,
      slug,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return ok(result, { requestId });
}
