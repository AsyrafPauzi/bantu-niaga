import type { NextResponse } from "next/server";
import { consume, type RateLimitOptions } from "@/lib/api/rate-limit";
import { tooManyRequests } from "@/lib/api/response";

/**
 * Returns a 429 response when the limit is exceeded, otherwise `null`.
 */
export function enforceRateLimit(
  opts: RateLimitOptions,
  requestId?: string,
): NextResponse | null {
  const rl = consume(opts);
  if (!rl.allowed) {
    return tooManyRequests(rl.retryAfterSeconds, { requestId });
  }
  return null;
}
