import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadUserMemberships } from "@/lib/auth/memberships";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/auth/memberships — businesses the user can switch to.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    const memberships = await loadUserMemberships(user.id, user.businessId);
    return NextResponse.json({ memberships }, { status: 200 });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
