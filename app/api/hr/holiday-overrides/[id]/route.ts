import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { hasPublicHolidaysAddon } from "@/lib/marketplace/entitlements";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: error.code },
        { status: 401 },
      );
    }
    throw error;
  }

  if (!canManageHrCore(user.role)) {
    return NextResponse.json(
      { error: "forbidden", reason: "hr access denied" },
      { status: 403 },
    );
  }

  const addonActive = await hasPublicHolidaysAddon(user.businessId);
  if (!addonActive) {
    return NextResponse.json(
      { error: "addon_required", message: "Public Holiday Calendar add-on required." },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("business_holiday_overrides")
    .delete()
    .eq("id", id)
    .eq("business_id", user.businessId);

  if (error) {
    return NextResponse.json(
      { error: "delete_failed", message: "Could not remove override." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
