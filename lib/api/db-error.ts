import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const GENERIC_MESSAGES: Record<string, string> = {
  list_failed: "Could not load records.",
  create_failed: "Could not create record.",
  update_failed: "Could not update record.",
  delete_failed: "Could not delete record.",
  search_failed: "Could not complete search.",
  rpc_failed: "Background job failed.",
};

/**
 * Log DB/RPC error server-side; return a safe client message (no `error.message` leak).
 */
export function dbErrorResponse(
  code: string,
  error: { message: string },
  logKey: string,
  context?: Record<string, unknown>,
  status = 500,
): NextResponse {
  logger.error(logKey, { dbError: error.message, ...context });
  const message =
    GENERIC_MESSAGES[code] ?? "Something went wrong. Please try again.";
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status },
  );
}
