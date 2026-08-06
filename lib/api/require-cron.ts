import type { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api/response";

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

/**
 * Validates `Authorization: Bearer <CRON_SECRET>`.
 * Returns a 401 response when invalid, or `null` when the caller may proceed.
 */
export function requireCronAuth(
  request: Request,
  requestId?: string,
): NextResponse | null {
  const id = requestId ?? getRequestId(request);
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    return unauthorized("CRON_SECRET is not configured.", { requestId: id });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized("Invalid cron credentials.", { requestId: id });
  }
  return null;
}
