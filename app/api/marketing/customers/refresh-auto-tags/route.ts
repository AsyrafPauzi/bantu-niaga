import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketing/customers/refresh-auto-tags
 * Recomputes auto-tags (VIP, dormant, at-risk, …) for the current business.
 */
export async function POST() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: "unauthorized", message: "Sign in required." } },
        { status: 401 },
      );
    }
    throw e;
  }

  if (!canSurface(user.role, "marketing", "customers")) {
    return NextResponse.json(
      { ok: false, error: { code: "forbidden", message: "No access." } },
      { status: 403 },
    );
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc("marketing_apply_auto_tags", {
    p_business_id: user.businessId,
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "server_error", message: "Could not refresh tags." },
      },
      { status: 500 },
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  const updated =
    row && typeof row === "object" && "updated_count" in row
      ? Number((row as { updated_count: unknown }).updated_count)
      : null;

  return NextResponse.json({
    ok: true,
    updated_count: Number.isFinite(updated) ? updated : null,
  });
}
