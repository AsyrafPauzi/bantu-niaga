import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { can, canSurface, type MarketingSurface } from "@/lib/permissions";

export async function requireMarketingUser(): Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (!can(user.role, "marketing")) {
      return {
        user: null,
        response: NextResponse.json(
          { ok: false, error: { code: "forbidden" } },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          { ok: false, error: { code: "unauthorized" } },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

/**
 * Guards a specific marketing surface (customers, content, segments, etc.)
 * using canSurface() for sub-pillar role checks.
 */
export async function requireMarketingSurface(surface: MarketingSurface): Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (!canSurface(user.role, "marketing", surface)) {
      return {
        user: null,
        response: NextResponse.json(
          { ok: false, error: { code: "forbidden" } },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          { ok: false, error: { code: "unauthorized" } },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}
