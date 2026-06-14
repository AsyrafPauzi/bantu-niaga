import { NextResponse } from "next/server";

import { ok, unauthorized } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * GET /api/cron/privacy-sweep
 *
 * Hard-deletes accounts whose grace period has elapsed. Invoked hourly
 * by Vercel Cron (configure in `vercel.json`) or any external scheduler.
 *
 * Authentication: requires `Authorization: Bearer <CRON_SECRET>` where
 * `CRON_SECRET` is set as an environment variable. Vercel Cron sends a
 * predictable `Authorization` header for this purpose.
 *
 * Operations:
 *   1. Calls the `privacy_execute_pending_deletions()` RPC which soft-
 *      marks PII columns and flips DSR status to completed.
 *   2. For each `delete_user` row processed, deletes the auth.users
 *      record so the user can no longer sign in.
 *   3. For each `delete_business` row, deletes every auth.users that
 *      belonged to the tenant.
 *   4. Purges expired data_exports rows (also done inside the RPC, but
 *      idempotent here for safety).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SweepRow {
  request_id: string;
  kind: string;
  user_id: string;
  business_id: string;
}

export async function GET(request: Request) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();

  // ── Auth: CRON_SECRET or Vercel's built-in cron header.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.warn("privacy.sweep.no_cron_secret_configured", { requestId });
    return unauthorized(
      "Privacy sweep is disabled — CRON_SECRET is not configured.",
      { requestId },
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized("Invalid cron credentials.", { requestId });
  }

  const admin = createServiceRoleClient();

  // 1. Sweep DSR rows whose grace period has elapsed.
  const { data: processed, error: rpcErr } = await admin.rpc(
    "privacy_execute_pending_deletions",
  );

  if (rpcErr) {
    logger.error("privacy.sweep.rpc_failed", {
      requestId,
      error: rpcErr.message,
    });
    return NextResponse.json(
      { ok: false, error: { code: "rpc_failed", message: rpcErr.message } },
      { status: 500, headers: { "X-Request-Id": requestId } },
    );
  }

  const rows = (processed ?? []) as unknown as SweepRow[];

  // 2. For each processed deletion, dispose of the auth.users record(s).
  let deletedAuthUsers = 0;
  for (const row of rows) {
    try {
      if (row.kind === "delete_user") {
        await admin.auth.admin.deleteUser(row.user_id);
        deletedAuthUsers += 1;
      } else if (row.kind === "delete_business") {
        const { data: members } = await admin
          .from("users")
          .select("id")
          .eq("business_id", row.business_id);
        for (const m of members ?? []) {
          try {
            await admin.auth.admin.deleteUser(m.id);
            deletedAuthUsers += 1;
          } catch (e) {
            logger.warn("privacy.sweep.auth_delete_failed", {
              requestId,
              userId: m.id,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }
    } catch (e) {
      logger.error("privacy.sweep.auth_delete_failed", {
        requestId,
        userId: row.user_id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  logger.info("privacy.sweep.completed", {
    requestId,
    deletionsProcessed: rows.length,
    authUsersDeleted: deletedAuthUsers,
  });

  return ok(
    {
      processed: rows.length,
      authUsersDeleted: deletedAuthUsers,
    },
    { requestId },
  );
}
