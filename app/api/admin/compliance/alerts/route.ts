import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ComplianceInAppAlert } from "@/lib/admin/task-compliance-schemas";

export const dynamic = "force-dynamic";

async function requireComplianceUser() {
  try {
    const user = await getCurrentUser();
    if (!canSurface(user.role, "admin", "compliance")) {
      return {
        user: null,
        response: NextResponse.json(
          { ok: false, error: { code: "forbidden", message: "Forbidden." } },
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
          { ok: false, error: { code: "unauthorized", message: "Auth required." } },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

export async function GET() {
  const auth = await requireComplianceUser();
  if (auth.response) return auth.response;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("compliance_in_app_alerts")
    .select(
      "id, business_id, compliance_item_id, notice_date, days_before, message, dismissed_at, created_at",
    )
    .eq("business_id", auth.user!.businessId)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "list_failed" } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: (data ?? []) as ComplianceInAppAlert[],
  });
}

export async function PATCH(request: Request) {
  const auth = await requireComplianceUser();
  if (auth.response) return auth.response;

  let body: { alert_id?: string };
  try {
    body = (await request.json()) as { alert_id?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_json", message: "Invalid JSON." } },
      { status: 400 },
    );
  }

  if (!body.alert_id) {
    return NextResponse.json(
      { ok: false, error: { code: "validation_failed", message: "alert_id required." } },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("compliance_in_app_alerts")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", body.alert_id)
    .eq("business_id", auth.user!.businessId)
    .is("dismissed_at", null);

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "dismiss_failed" } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
