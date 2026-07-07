import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { writeAuditLog } from "@/lib/audit/log";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { applyAnnualLeaveApproval } from "@/lib/hr/leave-balance";
import { leaveStatusUpdateSchema } from "@/lib/hr/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

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

export async function PATCH(request: Request, context: RouteContext) {
  const { user, response } = await requireHrUser();
  if (response) return response;

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = leaveStatusUpdateSchema.parse(body);
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

  const { data: existing } = await supabase
    .from("hr_leave_records")
    .select(
      "id, employee_id, leave_type, start_date, end_date, status, hr_employees(annual_leave_entitlement_days)",
    )
    .eq("business_id", user.businessId)
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: "not_found", message: "Leave record not found." },
      { status: 404 },
    );
  }

  const { data, error } = await supabase
    .from("hr_leave_records")
    .update({
      status: parsed.status,
      decision_note: parsed.decision_note ?? null,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("business_id", user.businessId)
    .eq("id", id)
    .select(
      "id, employee_id, leave_type, start_date, end_date, reason, status, decision_note, created_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "update_failed", message: "Could not update leave status." },
      { status: 500 },
    );
  }

  let balanceWarning = null;
  if (
    parsed.status === "approved" &&
    existing.status === "pending" &&
    existing.leave_type === "annual"
  ) {
    const entitlement = Number(
      (existing.hr_employees as { annual_leave_entitlement_days?: number } | null)
        ?.annual_leave_entitlement_days ?? 8,
    );
    const result = await applyAnnualLeaveApproval(supabase, {
      businessId: user.businessId,
      employeeId: existing.employee_id as string,
      startDate: String(existing.start_date),
      endDate: String(existing.end_date),
      entitlementDays: entitlement,
    });
    balanceWarning = result.warning;
  }

  await writeAuditLog(supabase, {
    businessId: user.businessId,
    actorUserId: user.id,
    action: "hr.leave.status",
    entityType: "hr_leave_records",
    entityId: id,
    diff: { status: parsed.status, balance_warning: balanceWarning?.code ?? null },
  });

  return NextResponse.json(
    { leave: data, warning: balanceWarning },
    { status: 200 },
  );
}
