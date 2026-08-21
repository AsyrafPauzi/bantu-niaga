import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";

export async function requireAdminUser(): Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (!can(user.role, "admin")) {
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
