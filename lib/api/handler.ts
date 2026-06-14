/**
 * Bantu Niaga — API route higher-order handler.
 *
 * Wraps a route handler with the enterprise concerns every endpoint
 * needs but nobody wants to copy-paste:
 *
 *   1. Request-id propagation                pulls or mints a uuid; threads
 *                                            it into the logger + response
 *                                            via `X-Request-Id`
 *   2. Authentication (optional)             calls getCurrentUser() and
 *                                            short-circuits with 401 if
 *                                            missing or 403 if role guard fails
 *   3. Rate limiting (optional)              fixed-window per (bucket, user/ip)
 *   4. Centralised error handling            unknown thrown errors become a
 *                                            sanitised 500 (no stack leak)
 *   5. Structured logging                    every request logs duration + status
 *
 * Usage:
 *
 *   export const POST = withApiHandler(
 *     {
 *       module: "social.meta.post",
 *       auth: { surface: ["marketing", "content"] },
 *       rateLimit: { bucket: "social.publish", limit: 30, windowMs: 60_000 },
 *     },
 *     async ({ user, request, requestId, log }) => {
 *       // …route logic…
 *       return ok({ … }, { requestId });
 *     },
 *   );
 */

import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { logger, type Logger } from "@/lib/logger";
import {
  forbidden,
  serverError,
  tooManyRequests,
  unauthorized,
  unprocessable,
} from "./response";
import {
  consume,
  clientIdentifierFromHeaders,
  rateLimitHeaders,
  type RateLimitOptions,
} from "./rate-limit";

interface AuthRequirement {
  /** Tuple [pillar, surface] passed to canSurface(). */
  surface?: Parameters<typeof canSurface> extends [
    infer _Role,
    infer Pillar,
    infer Surface,
  ]
    ? [Pillar, Surface]
    : [string, string];
  /** If true, anonymous callers are allowed. Default: false (auth required). */
  optional?: boolean;
}

interface HandlerOptions {
  /** Log tag (e.g. "social.meta.post"). */
  module: string;
  /** Authentication / authorization requirements. Default: auth required. */
  auth?: AuthRequirement | "none";
  /** Rate limit settings. Default: none. */
  rateLimit?: Omit<RateLimitOptions, "identifier">;
}

export interface HandlerCtx<Params = Record<string, string>> {
  request: NextRequest;
  /** Resolved route params from the Next.js dynamic-segment Promise. */
  params: Params;
  /** Caller info. Null when `auth: "none"`. */
  user: CurrentUser | null;
  /** Per-request unique id (also returned as X-Request-Id). */
  requestId: string;
  /** Pre-tagged logger. */
  log: Logger;
}

type HandlerFn<Params> = (ctx: HandlerCtx<Params>) => Promise<NextResponse>;

interface NextRouteContext<Params> {
  params: Promise<Params>;
}

export function withApiHandler<Params = Record<string, string>>(
  opts: HandlerOptions,
  fn: HandlerFn<Params>,
): (
  request: NextRequest,
  ctx?: NextRouteContext<Params>,
) => Promise<NextResponse> {
  return async (request, ctx) => {
    const start = Date.now();
    const requestId =
      request.headers.get("x-request-id") ?? randomUUID();
    const log = logger.child({ module: opts.module, requestId });

    // Resolve dynamic params (Next 15 makes these a Promise).
    let params: Params;
    try {
      params = ctx?.params ? await ctx.params : ({} as Params);
    } catch (e) {
      log.error("params_resolve_failed", undefined, e);
      return serverError(requestId);
    }

    // 1. Auth
    let user: CurrentUser | null = null;
    if (opts.auth !== "none") {
      const authReq: AuthRequirement = opts.auth ?? {};
      try {
        user = await getCurrentUser();
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          if (!authReq.optional) {
            return unauthorized(undefined, { requestId });
          }
        } else {
          log.error("auth_failed", undefined, e);
          return serverError(requestId);
        }
      }
      if (user && authReq.surface) {
        const [pillar, surface] = authReq.surface;
        if (
          !canSurface(
            user.role,
            pillar as Parameters<typeof canSurface>[1],
            surface as Parameters<typeof canSurface>[2],
          )
        ) {
          return forbidden(undefined, { requestId });
        }
      }
    }

    // 2. Rate limit (keyed on user id when authed, IP otherwise)
    let rlHeaders: Record<string, string> = {};
    if (opts.rateLimit) {
      const identifier = user
        ? `user:${user.id}`
        : clientIdentifierFromHeaders(request.headers);
      const result = consume({ ...opts.rateLimit, identifier });
      rlHeaders = rateLimitHeaders(result);
      if (!result.allowed) {
        log.warn("rate_limited", {
          bucket: opts.rateLimit.bucket,
          identifier,
          retryAfterSeconds: result.retryAfterSeconds,
        });
        return tooManyRequests(result.retryAfterSeconds, {
          requestId,
          headers: rlHeaders,
        });
      }
    }

    // 3. Run the handler
    try {
      const res = await fn({
        request,
        params,
        user,
        requestId,
        log: user
          ? log.child({ userId: user.id, businessId: user.businessId })
          : log,
      });

      for (const [k, v] of Object.entries(rlHeaders)) res.headers.set(k, v);

      const duration = Date.now() - start;
      log.info("request", {
        method: request.method,
        status: res.status,
        durationMs: duration,
      });
      return res;
    } catch (e) {
      // ZodError → 422 (validation_failed)
      if (e instanceof ZodError) {
        return unprocessable("Validation failed.", e.issues, { requestId });
      }
      // Anything else is a 500. Never leak the raw message in prod.
      log.error("unhandled_error", undefined, e);
      return serverError(requestId);
    }
  };
}
