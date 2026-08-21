/**
 * Bantu Niaga — root middleware.
 *
 * Two jobs:
 *   1. Keep the Supabase session cookie rotated on every matched request
 *      (via `updateSession`).
 *   2. Gate the protected app shell + protected API routes: when there is
 *      no authenticated session, redirect to `/sign-in` for HTML routes
 *      and return 401 JSON for API routes.
 *
 * Unauthenticated allow-list:
 *   - `/sign-in` itself
 *   - `/api/health`
 *   - `/(public)/...` route group (the customer-facing read-only pages
 *     under `[idcompany]`)
 *
 * The positive matcher at the bottom restricts this middleware to:
 *   - the authenticated app shell (`/(app)/...` top-level segments)
 *   - protected API routes
 * so we never run on `_next/*`, static files, or the public group.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isEmailVerified } from "@/lib/auth/email-verification-policy";
import {
  incompleteSessionDecision,
  isPublicAuthPath,
} from "@/lib/auth/incomplete-session";
import {
  getSupabasePublicEnv,
  warnSupabaseNotConfiguredOnce,
} from "@/lib/supabase/env";
import { csrfCheck } from "@/lib/security/csrf";

// ─── CSP nonce helpers ────────────────────────────────────────────────────────

function generateNonce(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const raw = c?.randomUUID ? c.randomUUID() : `${Math.random()}-${Date.now()}`;
  // base64-encode so it's safe inside a CSP header value
  return Buffer.from(raw).toString("base64");
}

function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const supabaseHost = (() => {
    try {
      return process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
        : "*.supabase.co";
    } catch {
      return "*.supabase.co";
    }
  })();

  const directives = [
    "default-src 'self'",
    // nonce-based: only scripts carrying this nonce are allowed.
    // 'strict-dynamic' lets nonce-approved scripts load further scripts (Next lazy chunks).
    isProd
      ? `script-src 'nonce-${nonce}' 'strict-dynamic' https://www.facebook.com https://connect.facebook.net`
      : `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https://www.facebook.com https://connect.facebook.net`,
    // Tailwind arbitrary values require unsafe-inline for styles — known trade-off.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com",
    `img-src 'self' data: blob: https://${supabaseHost} https://*.fbcdn.net https://platform-lookaside.fbsbx.com https://scontent.cdninstagram.com https://*.cdninstagram.com`,
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://graph.facebook.com https://api.openai.com https://api.ilmu.ai${
      isProd
        ? ""
        : " http://127.0.0.1:54321 ws://127.0.0.1:54321 https://127.0.0.1:54321 wss://127.0.0.1:54321"
    }`,
    "frame-src 'self' https://www.facebook.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://www.facebook.com",
    "manifest-src 'self'",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    isProd ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");

  return directives;
}

// ─── Idle timeout ─────────────────────────────────────────────────────────────
// 4-hour idle timeout on HTML page routes (not API). Cookie is renewed on every
// page navigation so active users are never interrupted.

const IDLE_COOKIE = "bn-last-active";
const IDLE_MAX_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Generate a short, opaque request id. We avoid `crypto.randomUUID()`
 * here because middleware runs on the Edge runtime in some deployments
 * and `node:crypto` is unavailable; the Web Crypto API gives us the same
 * thing via `crypto.randomUUID` on the global.
 */
function newRequestId(): string {
  // Edge runtime + Node 19+ both expose the Web Crypto API on globalThis.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `req-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

export async function middleware(request: NextRequest) {
  // Stamp a request id on every request so logs + UI errors can be
  // correlated end-to-end. Re-use the caller's value when present (used
  // by tracing systems, load-test harnesses, internal probes).
  const requestId = request.headers.get("x-request-id") ?? newRequestId();

  // Generate a fresh per-request nonce for the Content-Security-Policy.
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  // Pass nonce to server components via request header so layout.tsx can
  // apply it to <Script> tags without a client round-trip.
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("x-request-id", requestId);
  // Override the static CSP set in next.config.mjs with the nonce-bearing one.
  response.headers.set("Content-Security-Policy", csp);

  // ── CSRF origin check (state-mutating API routes only) ────────────────────
  // Validates Origin / Referer header for POST/PUT/PATCH/DELETE requests.
  // Exemptions (webhooks, external API, cron, staff, auth) are handled
  // inside csrfCheck() so we don't need to duplicate the allow-list here.
  const csrfError = csrfCheck(request);
  if (csrfError) {
    csrfError.headers.set("x-request-id", requestId);
    return csrfError;
  }

  const env = getSupabasePublicEnv();
  if (!env) {
    warnSupabaseNotConfiguredOnce("middleware");
    return response;
  }

  let user = null;
  let hasProfile = false;

  try {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.headers.set("x-request-id", requestId);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const result = await supabase.auth.getUser();
    user = result.data.user;

    if (user) {
      const { data: profileRow, error: profileLookupError } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (profileLookupError) {
        user = null;
      } else {
        hasProfile = Boolean(profileRow);
      }
    }
  } catch (err) {
    // Fail closed: if Supabase is unreachable, env is misconfigured, or the
    // SDK throws for any reason, treat the request as unauthenticated rather
    // than crashing the edge middleware (which surfaces as MIDDLEWARE_
    // INVOCATION_FAILED 500 in Vercel). Falling through lets the redirect /
    // 401 logic below take over so the user sees /sign-in instead of a 500.
     
    console.error(
      "[middleware] supabase.auth.getUser() failed; treating request as unauthenticated:",
      err instanceof Error ? err.message : err,
    );
    user = null;
  }

  const pathname = request.nextUrl.pathname;

  if (user) {
    if (!isEmailVerified(user)) {
      const allowedWhileUnverified =
        pathname === "/verify-email" ||
        pathname === "/api/auth/resend-verification" ||
        pathname === "/sign-up/complete" ||
        pathname === "/api/auth/complete-google-signup" ||
        pathname.startsWith("/auth/callback");

      if (!allowedWhileUnverified) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            {
              ok: false,
              error: {
                code: "email_not_verified",
                message: "Verify your email before using NiagaX.",
              },
              requestId,
            },
            {
              status: 403,
              headers: {
                "x-request-id": requestId,
                "Cache-Control": "private, no-store",
              },
            },
          );
        }

        const verifyUrl = request.nextUrl.clone();
        verifyUrl.pathname = "/verify-email";
        verifyUrl.search = "";
        if (user.email) {
          verifyUrl.searchParams.set("email", user.email);
        }
        const redirect = NextResponse.redirect(verifyUrl);
        redirect.headers.set("x-request-id", requestId);
        return redirect;
      }
    }

    const decision = incompleteSessionDecision({
      pathname,
      hasProfile,
    });
    if (decision === "forbidden_api") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "signup_incomplete",
            message: "Finish creating your business first.",
          },
          requestId,
        },
        {
          status: 403,
          headers: {
            "x-request-id": requestId,
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    if (decision === "redirect_complete") {
      const completeUrl = request.nextUrl.clone();
      completeUrl.pathname = "/sign-up/complete";
      completeUrl.search = "";
      const redirect = NextResponse.redirect(completeUrl);
      redirect.headers.set("x-request-id", requestId);
      return redirect;
    }

    // ── Idle timeout (HTML page routes only, not API / static) ────────────────
    // API routes are excluded to avoid breaking background polling / webhooks.
    if (!pathname.startsWith("/api/")) {
      const lastActive = request.cookies.get(IDLE_COOKIE)?.value;
      const now = Date.now();
      if (lastActive && now - parseInt(lastActive, 10) > IDLE_MAX_MS) {
        // Session idle too long — redirect to sign-in.
        const signInUrl = request.nextUrl.clone();
        signInUrl.pathname = "/sign-in";
        signInUrl.search = "";
        const redirect = NextResponse.redirect(signInUrl);
        redirect.headers.set("x-request-id", requestId);
        redirect.headers.set("Content-Security-Policy", csp);
        // Clear the stale cookie.
        redirect.cookies.delete(IDLE_COOKIE);
        return redirect;
      }
      // Renew the last-active timestamp on every page navigation.
      response.cookies.set(IDLE_COOKIE, String(now), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24, // survive a browser restart; idle logic handles expiry
      });
    }

    return response;
  }

  if (isPublicAuthPath(pathname)) {
    return response;
  }

  // Registration and password recovery must work while logged out.
  if (
    pathname === "/api/auth/sign-up" ||
    pathname === "/api/auth/complete-google-signup" ||
    pathname === "/api/auth/add-business" ||
    pathname === "/api/auth/forgot-password" ||
    pathname === "/api/auth/reset-password" ||
    pathname === "/api/auth/resend-verification" ||
    pathname === "/api/auth/accept-invite"
  ) {
    return response;
  }

  // Cron routes authenticate via CRON_SECRET inside the route handler (no user session).
  if (pathname.startsWith("/api/cron/")) {
    return response;
  }

  // Staff leave links are token-based (no user session).
  if (pathname.startsWith("/api/staff/")) {
    return response;
  }

  // Tenant REST API — authenticates via bn_live_ API key in the route handler.
  if (pathname.startsWith("/api/external/")) {
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "unauthorized", message: "Authentication required." },
        requestId,
      },
      {
        status: 401,
        headers: {
          "x-request-id": requestId,
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  const signInUrl = request.nextUrl.clone();
  signInUrl.pathname = "/sign-in";
  signInUrl.search = "";
  const redirect = NextResponse.redirect(signInUrl);
  redirect.headers.set("x-request-id", requestId);
  return redirect;
}

export const config = {
  /*
   * Positive matcher. Only run middleware on the authenticated app shell
   * (`app/(app)/...`) and protected API routes. This automatically skips:
   *
   *   - `_next/static`, `_next/image`            (Next internals)
   *   - `favicon.ico` and any file in `/public/` (anything with a `.`)
   *   - `/api/health`                            (uptime probe; anonymous)
   *   - the public `[idcompany]` route group     (`/[idcompany]/...`)
   *   - the root landing page (`/`)              (redirects to /home)
   *   - the `/sign-in` page                      (must be reachable while logged out)
   */
  matcher: [
    "/(add-company|admin|boardroom|finance|home|hr|marketing|marketplace|more|operations|sales|settings)/:path*",
    "/super-admin/:path*",
    "/sign-in",
    "/sign-up",
    "/sign-up/:path*",
    "/legal/:path*",
    "/onboarding/:path*",
    "/api/((?!health|webhooks).*)",
  ],
};
