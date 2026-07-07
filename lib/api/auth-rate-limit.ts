import { consume, clientIdentifierFromHeaders, rateLimitHeaders } from "@/lib/api/rate-limit";

export function enforceAuthRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number,
):
  | { ok: true; headers: Record<string, string> }
  | { ok: false; response: Response } {
  const identifier = clientIdentifierFromHeaders(request.headers);
  const result = consume({ bucket, identifier, limit, windowMs });
  const headers = rateLimitHeaders(result);

  if (!result.allowed) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: "rate_limited",
          message: "Too many requests. Try again later.",
          retry_after_seconds: result.retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(result.retryAfterSeconds),
            ...headers,
          },
        },
      ),
    };
  }

  return { ok: true, headers };
}
