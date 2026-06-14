/**
 * Bantu Niaga — structured logger.
 *
 * Single source of truth for server-side log output. Use this instead of
 * `console.*` so:
 *
 *   1. Log entries are structured JSON in production (machine-parseable by
 *      Datadog/Logflare/Vercel logs).
 *   2. Sensitive fields are redacted before serialization (defence-in-depth
 *      against accidentally logging a token or password).
 *   3. Log level is filterable via `LOG_LEVEL` env var (default "info").
 *
 * Usage:
 *
 *   import { logger } from "@/lib/logger";
 *
 *   const log = logger.child({ module: "social.meta" });
 *   log.info("connected", { businessId, pages: 1 });
 *   log.error("graph_failed", { code: "rate_limited" }, error);
 *
 * Never pass an `Error` instance into the `meta` object — pass it as the
 * third arg so the stack is normalised properly.
 */

import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const envLevel = ((): LogLevel => {
  const raw = (process.env.LOG_LEVEL ?? "").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
})();

const minRank = LEVEL_RANK[envLevel];

/**
 * Keys whose values are redacted before serialization regardless of where
 * they appear in the nested meta object. Keep this list narrow — log
 * call-sites are expected to never log raw tokens/passwords/PII in the
 * first place; this is the safety net.
 */
const REDACT_KEYS = new Set([
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "token",
  "password",
  "secret",
  "api_key",
  "apiKey",
  "authorization",
  "cookie",
  "client_secret",
  "service_role_key",
  "anon_key",
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "string") {
    // Belt-and-suspenders: redact strings that *look* like a token even
    // when the key wasn't matched. Crude but effective for JWTs / hex.
    if (value.length > 24 && /^[A-Za-z0-9_\-.]+$/.test(value) && value.includes(".")) {
      return "[REDACTED_TOKEN]";
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k) || REDACT_KEYS.has(k.toLowerCase())) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

function serializeError(err: unknown): Record<string, unknown> | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      // Stack only in non-prod or when LOG_STACK=1 to keep prod payloads small.
      stack:
        process.env.NODE_ENV !== "production" || process.env.LOG_STACK === "1"
          ? err.stack
          : undefined,
      // Pull common typed-error fields if present.
      code: (err as { code?: unknown }).code,
      status: (err as { status?: unknown }).status,
    };
  }
  return { value: String(err) };
}

interface LogContext {
  module?: string;
  requestId?: string;
  userId?: string;
  businessId?: string;
}

export interface Logger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>, err?: unknown) => void;
  error: (msg: string, meta?: Record<string, unknown>, err?: unknown) => void;
  child: (extra: LogContext) => Logger;
}

function emit(
  level: LogLevel,
  ctx: LogContext,
  msg: string,
  meta?: Record<string, unknown>,
  err?: unknown,
): void {
  if (LEVEL_RANK[level] < minRank) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    msg,
    ...ctx,
    ...(meta ? (redact(meta) as Record<string, unknown>) : {}),
    err: serializeError(err),
  };

  // Drop undefined keys so logs stay tidy.
  for (const k of Object.keys(entry)) {
    if ((entry as Record<string, unknown>)[k] === undefined) {
      delete (entry as Record<string, unknown>)[k];
    }
  }

  if (process.env.NODE_ENV === "production") {
    // JSON on stdout/stderr — picked up by Vercel/Datadog parsers.
    const line = JSON.stringify(entry);
    if (level === "error") process.stderr.write(line + "\n");
    else process.stdout.write(line + "\n");
    return;
  }

  // Pretty in dev. Keep it terse — devs want signal, not a wall of JSON.
  // eslint-disable-next-line no-console
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  const tag = ctx.module ? `[${ctx.module}]` : "[app]";
  fn(`${tag} ${level.toUpperCase()} ${msg}`, {
    ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
    ...(meta ? (redact(meta) as Record<string, unknown>) : {}),
    ...(err ? { err: serializeError(err) } : {}),
  });
}

function build(ctx: LogContext): Logger {
  return {
    debug: (msg, meta) => emit("debug", ctx, msg, meta),
    info: (msg, meta) => emit("info", ctx, msg, meta),
    warn: (msg, meta, err) => emit("warn", ctx, msg, meta, err),
    error: (msg, meta, err) => emit("error", ctx, msg, meta, err),
    child: (extra) => build({ ...ctx, ...extra }),
  };
}

export const logger: Logger = build({});
