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
import {
  getSupabasePublicEnv,
  warnSupabaseNotConfiguredOnce,
} from "@/lib/supabase/env";

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
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("x-request-id", requestId);

  const env = getSupabasePublicEnv();
  if (!env) {
    warnSupabaseNotConfiguredOnce("middleware");
    return response;
  }

  let user = null;

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
  } catch (err) {
    // Fail closed: if Supabase is unreachable, env is misconfigured, or the
    // SDK throws for any reason, treat the request as unauthenticated rather
    // than crashing the edge middleware (which surfaces as MIDDLEWARE_
    // INVOCATION_FAILED 500 in Vercel). Falling through lets the redirect /
    // 401 logic below take over so the user sees /sign-in instead of a 500.
    // eslint-disable-next-line no-console
    console.error(
      "[middleware] supabase.auth.getUser() failed; treating request as unauthenticated:",
      err instanceof Error ? err.message : err,
    );
    user = null;
  }

  if (user) return response;

  const pathname = request.nextUrl.pathname;

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
    "/(admin|boardroom|finance|home|hr|marketing|marketplace|more|operations|sales|settings)/:path*",
    "/super-admin/:path*",
    "/api/((?!health).*)",
  ],
};
