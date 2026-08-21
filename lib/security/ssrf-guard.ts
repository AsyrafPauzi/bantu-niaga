/**
 * Bantu Niaga — SSRF (Server-Side Request Forgery) Guard.
 *
 * Any code that makes an outbound HTTP/HTTPS fetch using a URL that was
 * influenced by user-supplied data MUST validate that URL through this
 * module before fetching.
 *
 * The guard enforces three layers:
 *
 *   1. Protocol allowlist — only `https:` is permitted in production.
 *   2. Host allowlist    — the target host must exactly match one of the
 *                          known-good external services this app integrates
 *                          with. No wildcard glob matching to avoid bypasses.
 *   3. Private-range block — even if a host resolves to a private RFC-1918
 *                          address, the URL shape must not look like a
 *                          loopback / internal address.
 *
 * Usage:
 *
 *   import { assertSafeUrl } from "@/lib/security/ssrf-guard";
 *
 *   // Throws SsrfBlockedError if the URL is not on the allowlist.
 *   assertSafeUrl(userSuppliedUrl);
 *   const response = await fetch(userSuppliedUrl);
 *
 * Or if you need a non-throwing check:
 *
 *   const result = checkSafeUrl(userSuppliedUrl);
 *   if (!result.safe) { ... handle result.reason ... }
 */

import "server-only";

// ─── Allowed external hosts ───────────────────────────────────────────────────
// Each entry is an exact hostname or a suffix pattern (prefixed with ".").
// Add entries here when integrating a new 3rd-party service.
const ALLOWED_HOSTS: readonly string[] = [
  // Supabase — REST, Auth, Realtime, Storage
  ".supabase.co",
  // Meta Graph API
  "graph.facebook.com",
  "graph.instagram.com",
  // Meta CDNs (for avatar / post images fetched server-side)
  ".fbcdn.net",
  "platform-lookaside.fbsbx.com",
  ".cdninstagram.com",
  // ILMU AI (YTL)
  "api.ilmu.ai",
  // Billplz payment gateway
  "www.billplz.com",
  "billplz.com",
  // Resend transactional email
  "api.resend.com",
  // Cloudflare R2 (presigned URLs resolve to these)
  ".r2.cloudflarestorage.com",
  ".cloudflare.com",
];

// Patterns that indicate private / loopback addresses regardless of hostname.
const PRIVATE_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^::1$/,             // IPv6 loopback
  /^fc[0-9a-f]{2}:/i, // IPv6 ULA
  /^fe80:/i,           // IPv6 link-local
  /^0\.0\.0\.0$/,
  /^169\.254\.\d+\.\d+$/, // APIPA / link-local
  /^100\.6[4-9]\.\d+\.\d+$/, // RFC 6598 CGN range
  /^100\.[7-9]\d\.\d+\.\d+$/,
  /^100\.1[0-2]\d\.\d+\.\d+$/,
];

export class SsrfBlockedError extends Error {
  constructor(
    public readonly reason: string,
    public readonly url: string,
  ) {
    super(`SSRF guard blocked request to "${url}": ${reason}`);
    this.name = "SsrfBlockedError";
  }
}

export interface SsrfCheckResult {
  safe: boolean;
  reason?: string;
}

/**
 * Check a URL without throwing.
 */
export function checkSafeUrl(raw: string): SsrfCheckResult {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { safe: false, reason: "malformed_url" };
  }

  const { protocol, hostname, port } = parsed;

  // 1. Protocol check
  const isProd = process.env.NODE_ENV === "production";
  const allowedProtocols = isProd ? ["https:"] : ["https:", "http:"];
  if (!allowedProtocols.includes(protocol)) {
    return { safe: false, reason: `disallowed_protocol:${protocol}` };
  }

  // 2. Block private / loopback ranges
  for (const pattern of PRIVATE_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      return { safe: false, reason: `private_host:${hostname}` };
    }
  }

  // Block non-standard ports that might route to internal services.
  if (port && !["80", "443", ""].includes(port)) {
    return { safe: false, reason: `non_standard_port:${port}` };
  }

  // 3. Host allowlist check
  for (const allowed of ALLOWED_HOSTS) {
    if (allowed.startsWith(".")) {
      // Suffix match: ".supabase.co" matches "xyz.supabase.co"
      if (hostname === allowed.slice(1) || hostname.endsWith(allowed)) {
        return { safe: true };
      }
    } else {
      if (hostname === allowed) return { safe: true };
    }
  }

  return { safe: false, reason: `host_not_allowlisted:${hostname}` };
}

/**
 * Assert that a URL is safe to fetch. Throws `SsrfBlockedError` if not.
 * Use this as the gate before any `fetch()` call driven by user input.
 */
export function assertSafeUrl(raw: string): void {
  const result = checkSafeUrl(raw);
  if (!result.safe) {
    throw new SsrfBlockedError(result.reason ?? "unknown", raw);
  }
}
