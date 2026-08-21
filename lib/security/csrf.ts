/**
 * Bantu Niaga — CSRF Origin validation.
 *
 * Defense-in-depth layer on top of the Supabase `SameSite=Lax` session
 * cookies that @supabase/ssr sets. Lax blocks cross-site POSTs from
 * top-level navigations, but not same-site subdomain attacks or requests
 * made by browser extensions / native apps with cookies. An explicit
 * Origin / Referer check closes that gap.
 *
 * Strategy:
 *   1. Skip safe HTTP methods (GET, HEAD, OPTIONS).
 *   2. Skip routes that need to accept requests from untrusted origins
 *      (webhooks, external REST API, cron, staff token links).
 *   3. For all other mutating requests, require the `Origin` (or `Referer`)
 *      header to match the configured app origin.
 *
 * Usage in middleware.ts:
 *
 *   import { csrfCheck } from "@/lib/security/csrf";
 *
 *   const csrfError = csrfCheck(request);
 *   if (csrfError) return csrfError;
 */

import { NextResponse, type NextRequest } from "next/server";

// Methods that carry no side-effects — always safe to allow.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Paths that must accept requests from external origins by design.
// Supabase webhooks, Billplz payment callbacks, Vercel cron, tenant REST
// API, and token-based staff links all fall into this category.
const EXEMPT_PREFIXES = [
  "/api/webhooks/",   // Billplz, Supabase auth callbacks
  "/api/external/",   // Tenant REST API (API-key authenticated)
  "/api/cron/",       // Vercel cron (CRON_SECRET authenticated)
  "/api/staff/",      // Token-based leave links
  "/api/auth/",       // Public auth mutations (sign-up, forgot-password…)
];

/**
 * Returns the trusted origin derived from `NEXT_PUBLIC_APP_URL`.
 * Falls back to nothing — if not set every origin check will fail,
 * which is the secure default.
 */
function trustedOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) return null;
  try {
    const { origin } = new URL(raw);
    return origin; // e.g. "https://app.bantuniaga.com"
  } catch {
    return null;
  }
}

/**
 * Checks the request for a valid same-origin marker on state-mutating
 * requests. Returns a 403 `NextResponse` when the check fails, `null`
 * when the request is allowed to proceed.
 */
export function csrfCheck(request: NextRequest): NextResponse | null {
  if (SAFE_METHODS.has(request.method)) return null;

  const { pathname } = request.nextUrl;
  for (const prefix of EXEMPT_PREFIXES) {
    if (pathname.startsWith(prefix)) return null;
  }

  const trusted = trustedOrigin();
  // If no APP_URL is configured (local dev without .env.local), allow —
  // but warn so it doesn't go unnoticed.
  if (!trusted) {
    if (process.env.NODE_ENV === "production") {
      // In production a missing APP_URL is a misconfiguration. Block.
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "csrf_misconfigured",
            message: "Server misconfiguration. Please contact support.",
          },
        },
        { status: 500 },
      );
    }
    // In dev, allow but log.
    // eslint-disable-next-line no-console
    console.warn("[csrf] NEXT_PUBLIC_APP_URL not set — CSRF check skipped in dev.");
    return null;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    if (origin === trusted) return null;
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "csrf_origin_mismatch",
          message: "Request blocked: cross-origin mutation not allowed.",
        },
      },
      {
        status: 403,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  // No Origin header — fall back to Referer (older browsers / curl).
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const { origin: refOrigin } = new URL(referer);
      if (refOrigin === trusted) return null;
    } catch {
      // Malformed Referer header — treat as untrusted.
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "csrf_referer_mismatch",
          message: "Request blocked: cross-origin referer not allowed.",
        },
      },
      {
        status: 403,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  // Neither Origin nor Referer — only allow from curl/Postman in dev.
  // In production, block to be safe.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "csrf_missing_origin",
          message: "Request blocked: missing origin header.",
        },
      },
      {
        status: 403,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  return null; // dev: allow header-less requests (Postman / curl)
}
