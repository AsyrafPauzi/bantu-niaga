import { NextResponse } from "next/server";
import type { CurrentUser } from "@/lib/auth/current-user";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { hasStaffAppraisalAddon } from "@/lib/marketplace/entitlements";

export async function requireStaffAppraisalAccess(): Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (!canManageHrCore(user.role)) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "forbidden", reason: "hr access denied" },
          { status: 403 },
        ),
      };
    }

    const addonActive = await hasStaffAppraisalAddon(user.businessId);
    if (!addonActive) {
      return {
        user: null,
        response: NextResponse.json(
          {
            error: "addon_required",
            message:
              "Activate Staff Appraisal Checker in the Marketplace first.",
            marketplace_href: "/marketplace",
          },
          { status: 403 },
        ),
      };
    }

    return { user, response: null };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "unauthorized", code: error.code },
          { status: 401 },
        ),
      };
    }
    throw error;
  }
}
