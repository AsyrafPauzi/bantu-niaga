/**
 * Bantu Niaga — root middleware.
 *
 * Today: refreshes the Supabase session on every (matched) request via
 * `updateSession`, which keeps the auth cookie rotated and lets server
 * components see a current user.
 *
 * Tomorrow: this is also where API permission gating will live. See the
 * sketch below.
 */
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);

  // ───────────────────────────────────────────────────────────────────────
  // TODO: API permission gating (Phase 0.x)
  //
  // Once Supabase Auth is wired, add a `requireRole` helper that runs
  // *before* the route handler executes. Sketch:
  //
  //   import { NextResponse } from 'next/server';
  //   import type { Role } from '@/lib/permissions';
  //
  //   async function requireRole(req: NextRequest, allowed: Role[]) {
  //     const { role } = await getCurrentUserFromRequest(req);
  //     if (!allowed.includes(role)) {
  //       return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  //     }
  //     return null;
  //   }
  //
  //   if (request.nextUrl.pathname.startsWith('/api/finance/')) {
  //     const denied = await requireRole(request, ['owner', 'manager', 'accountant']);
  //     if (denied) return denied;
  //   }
  //
  // The matcher below already excludes the public read-only `/[idcompany]/...`
  // routes and `/api/health`, so this gating won't run on them.
  // ───────────────────────────────────────────────────────────────────────
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
   *   - the root landing page (`/`)
   *
   * When new top-level app segments are added (e.g. a future `/inbox` page),
   * remember to extend the first matcher entry below.
   */
  matcher: [
    "/(admin|boardroom|finance|home|hr|marketing|marketplace|more|operations|sales|settings)/:path*",
    "/api/((?!health).*)",
  ],
};
