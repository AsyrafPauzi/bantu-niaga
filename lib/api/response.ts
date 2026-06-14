/**
 * Bantu Niaga — standard API response envelope.
 *
 * Every JSON response from an API route handler should go through one of
 * these helpers so the wire format stays consistent for clients (and so
 * we never accidentally leak an Error instance to the browser).
 *
 * Success envelope:
 *
 *   { ok: true,  data: <T>, requestId: "..." }
 *
 * Error envelope:
 *
 *   { ok: false, error: { code, message, details? }, requestId: "..." }
 *
 * Headers:
 *
 *   - `X-Request-Id`             threads requestId for log correlation
 *   - `Cache-Control: private, no-store`   API responses must never be cached
 *                                          by a CDN. `next.config.mjs` already
 *                                          sets this at the edge, but doing
 *                                          it here protects ad-hoc routes too.
 */

import { NextResponse } from "next/server";

export interface ApiErrorBody {
  code: string;
  message: string;
  /** Optional per-route extension (e.g. Zod issues). */
  details?: unknown;
}

const NO_STORE: Record<string, string> = {
  "Cache-Control": "private, no-store, max-age=0",
};

function withCommon(
  res: NextResponse,
  requestId?: string,
): NextResponse {
  if (requestId) res.headers.set("X-Request-Id", requestId);
  for (const [k, v] of Object.entries(NO_STORE)) res.headers.set(k, v);
  return res;
}

export interface ResponseOptions {
  requestId?: string;
  /** Extra headers to attach (e.g. `Retry-After`). */
  headers?: Record<string, string>;
}

function applyExtra(
  res: NextResponse,
  options?: ResponseOptions,
): NextResponse {
  if (options?.headers) {
    for (const [k, v] of Object.entries(options.headers)) res.headers.set(k, v);
  }
  return withCommon(res, options?.requestId);
}

// ─────────────────────────────────────────────────────────────────────────
// Success
// ─────────────────────────────────────────────────────────────────────────

export function ok<T>(data: T, options?: ResponseOptions): NextResponse {
  return applyExtra(
    NextResponse.json(
      { ok: true, data, requestId: options?.requestId },
      { status: 200 },
    ),
    options,
  );
}

export function created<T>(data: T, options?: ResponseOptions): NextResponse {
  return applyExtra(
    NextResponse.json(
      { ok: true, data, requestId: options?.requestId },
      { status: 201 },
    ),
    options,
  );
}

export function noContent(options?: ResponseOptions): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  return applyExtra(res, options);
}

// ─────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────

export function errorJson(
  status: number,
  body: ApiErrorBody,
  options?: ResponseOptions,
): NextResponse {
  return applyExtra(
    NextResponse.json(
      { ok: false, error: body, requestId: options?.requestId },
      { status },
    ),
    options,
  );
}

export function badRequest(
  message: string,
  details?: unknown,
  options?: ResponseOptions,
): NextResponse {
  return errorJson(400, { code: "bad_request", message, details }, options);
}

export function unauthorized(
  message = "Authentication required.",
  options?: ResponseOptions,
): NextResponse {
  return errorJson(401, { code: "unauthorized", message }, options);
}

export function forbidden(
  message = "You don't have permission to perform this action.",
  options?: ResponseOptions,
): NextResponse {
  return errorJson(403, { code: "forbidden", message }, options);
}

export function notFound(
  message = "Resource not found.",
  options?: ResponseOptions,
): NextResponse {
  return errorJson(404, { code: "not_found", message }, options);
}

export function conflict(
  message: string,
  details?: unknown,
  options?: ResponseOptions,
): NextResponse {
  return errorJson(409, { code: "conflict", message, details }, options);
}

export function unprocessable(
  message: string,
  details?: unknown,
  options?: ResponseOptions,
): NextResponse {
  return errorJson(
    422,
    { code: "validation_failed", message, details },
    options,
  );
}

export function tooManyRequests(
  retryAfterSeconds: number,
  options?: ResponseOptions,
): NextResponse {
  return errorJson(
    429,
    {
      code: "rate_limited",
      message: `Too many requests. Retry in ${retryAfterSeconds}s.`,
    },
    {
      ...options,
      headers: {
        ...(options?.headers ?? {}),
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))),
      },
    },
  );
}

export function serverError(
  requestId?: string,
  /** Optional public hint (avoid leaking internals — never include err.message in prod). */
  publicMessage = "Something went wrong.",
): NextResponse {
  return errorJson(
    500,
    { code: "internal_error", message: publicMessage },
    { requestId },
  );
}
