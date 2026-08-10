import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrLeaveTypeSettings } from "@/lib/hr/leave-type-settings";
import { leaveTypeSettingsUpdateSchema } from "@/lib/hr/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireHrUser() {
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

export async function GET() {
  const { user, response } = await requireHrUser();
  if (response) return response;

  const supabase = await createSupabaseServerClient();
  const settings = await loadHrLeaveTypeSettings(supabase, user.businessId);
  return NextResponse.json({ data: settings }, { status: 200 });
}

export async function PUT(request: Request) {
  const { user, response } = await requireHrUser();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = leaveTypeSettingsUpdateSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  const supabase = await createSupabaseServerClient();
  const rows = parsed.settings.map((row) => ({
    business_id: user.businessId,
    leave_type: row.leave_type,
    default_quota_days: row.default_quota_days ?? null,
    attachment_required: row.attachment_required ?? false,
    enabled: row.enabled ?? true,
  }));

  const { error } = await supabase
    .from("hr_leave_type_settings")
    .upsert(rows, { onConflict: "business_id,leave_type" });

  if (error) {
    return NextResponse.json(
      { error: "update_failed", message: error.message },
      { status: 500 },
    );
  }

  const settings = await loadHrLeaveTypeSettings(supabase, user.businessId);
  return NextResponse.json({ data: settings }, { status: 200 });
}
