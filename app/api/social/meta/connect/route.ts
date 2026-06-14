import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import {
  buildAuthUrl,
  isMetaConfigured,
  missingMetaEnvVars,
} from "@/lib/social/meta";

/**
 * GET /api/social/meta/connect
 *
 * Kicks off the Meta (Facebook) Login → Page-token flow:
 *
 *   1. Generate a random `state` token, stash it in an HttpOnly cookie
 *   2. Redirect the browser to Meta's OAuth dialog
 *   3. After the user grants permission, Meta redirects back to
 *      `/api/social/meta/callback` with `?code=…&state=…`.
 *
 * The user must already be signed in AND have access to the marketing
 * surface, otherwise we return 401/403 (no point connecting accounts
 * that the role cannot then use).
 */

export const dynamic = "force-dynamic";

const STATE_COOKIE = "bn_meta_oauth_state";
const STATE_TTL_SECONDS = 600; // 10 minutes

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!canSurface(user.role, "marketing", "content")) {
      return NextResponse.json(
        { error: "forbidden", reason: "marketing.content access required" },
        { status: 403 },
      );
    }

    if (!isMetaConfigured()) {
      return NextResponse.json(
        {
          error: "not_configured",
          message:
            "Meta integration is not configured on this server. " +
            `Add the following env var(s) to .env.local: ${missingMetaEnvVars().join(", ")}.`,
          missing: missingMetaEnvVars(),
        },
        { status: 400 },
      );
    }

    const state = randomBytes(16).toString("hex");
    const url = buildAuthUrl(state);

    const jar = await cookies();
    jar.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: STATE_TTL_SECONDS,
    });

    return NextResponse.redirect(url, { status: 302 });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }
}
