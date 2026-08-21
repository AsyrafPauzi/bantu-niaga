/**
 * Bantu Niaga — Security Audit Log.
 *
 * Emits structured, machine-parseable security events to stdout/stderr so
 * they can be ingested by Vercel Log Drains, Datadog, Logflare, or any
 * SIEM that reads newline-delimited JSON.
 *
 * Why a dedicated module instead of the generic logger?
 *   - Security events need a stable, queryable schema (SIEM rules depend on it).
 *   - They are always emitted at `warn` or `error` severity so they are
 *     never suppressed by `LOG_LEVEL`.
 *   - The `event_type` field makes SIEM alert rules predictable:
 *       e.g. "alert on > 10 `auth.failed` from the same IP in 60 s"
 *
 * Usage:
 *
 *   import { securityLog } from "@/lib/security/audit-log";
 *
 *   securityLog("auth.failed", { ip, email, reason: "bad_password" });
 *   securityLog("rate_limit.hit", { ip, bucket, userId }, "warn");
 *   securityLog("idor.attempt", { userId, resourceId }, "error");
 *
 * All calls are fire-and-forget (synchronous). Keep metadata lean — no
 * secrets, no PII beyond what is strictly necessary for incident triage.
 */

import "server-only";

export type SecurityEventType =
  // Authentication
  | "auth.failed"              // sign-in attempt rejected (bad creds / no session)
  | "auth.email_unverified"    // blocked because email not confirmed
  | "auth.signup_incomplete"   // blocked because business profile not created
  | "auth.idle_timeout"        // session expired due to inactivity
  // Authorization
  | "authz.forbidden"          // valid session but wrong role/surface
  | "authz.idor_attempt"       // user tried to access another tenant's resource
  | "authz.csrf_blocked"       // CSRF origin/referer check failed
  // Rate limiting / abuse
  | "rate_limit.hit"           // request rejected by rate limiter
  | "rate_limit.burst"         // unusually high request rate (informational)
  // Input / file attacks
  | "input.validation_failed"  // Zod / manual validation rejected the payload
  | "file.mime_rejected"       // uploaded file MIME type not on allowlist
  | "file.size_exceeded"       // uploaded file exceeds the configured maximum
  // SSRF
  | "ssrf.blocked"             // outbound URL rejected by the SSRF guard
  // Secrets / config
  | "config.missing_secret"    // a required env secret is absent at runtime
  // Generic
  | "security.suspicious";     // catch-all for manually flagged anomalies

export type SecurityEventSeverity = "warn" | "error";

export interface SecurityEventMeta {
  /** Authenticated user id, if known. */
  userId?: string;
  /** Tenant / business id, if known. */
  businessId?: string;
  /** Client IP address. Never logged as the sole identifier. */
  ip?: string;
  /** The pathname of the request being protected. */
  path?: string;
  /** HTTP method of the offending request. */
  method?: string;
  /** Correlation id from `x-request-id`. */
  requestId?: string;
  /** Additional structured context relevant to this event type. */
  [key: string]: unknown;
}

interface AuditEntry {
  level: SecurityEventSeverity;
  time: string;
  category: "security";
  event_type: SecurityEventType;
  [key: string]: unknown;
}

/**
 * Emit a security audit event. Always written regardless of `LOG_LEVEL`.
 *
 * @param eventType  Stable event type identifier (used for SIEM rules).
 * @param meta       Structured context. Must not contain secrets or raw tokens.
 * @param severity   "warn" (default) or "error".
 */
export function securityLog(
  eventType: SecurityEventType,
  meta?: SecurityEventMeta,
  severity: SecurityEventSeverity = "warn",
): void {
  const entry: AuditEntry = {
    level: severity,
    time: new Date().toISOString(),
    category: "security",
    event_type: eventType,
    ...sanitizeMeta(meta),
  };

  // Drop undefined values to keep payloads terse.
  for (const k of Object.keys(entry)) {
    if ((entry as Record<string, unknown>)[k] === undefined) {
      delete (entry as Record<string, unknown>)[k];
    }
  }

  const line = JSON.stringify(entry);
  if (process.env.NODE_ENV === "production") {
    // In production, route errors to stderr (picked up by Vercel as error
    // logs) and warnings to stdout (info tier).
    if (severity === "error") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
    return;
  }

  // Human-readable in dev.
  const label = `[security:${eventType}]`;
  if (severity === "error") {
    // eslint-disable-next-line no-console
    console.error(label, meta ?? {});
  } else {
    // eslint-disable-next-line no-console
    console.warn(label, meta ?? {});
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const REDACT_KEYS = new Set([
  "password",
  "token",
  "secret",
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "api_key",
  "apiKey",
  "authorization",
  "cookie",
]);

function sanitizeMeta(meta?: SecurityEventMeta): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (REDACT_KEYS.has(k) || REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else if (typeof v === "string" && v.length > 24 && /^[A-Za-z0-9_\-.]+$/.test(v) && v.includes(".")) {
      // Looks like a JWT — redact.
      out[k] = "[REDACTED_TOKEN]";
    } else {
      out[k] = v;
    }
  }
  return out;
}
