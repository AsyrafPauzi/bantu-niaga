import { NextResponse } from "next/server";
import { loadStaffMeLeaveRecord } from "@/lib/hr/load";
import { requireStaffMeContext } from "@/lib/hr/staff-self-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const ctx = await requireStaffMeContext();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await context.params;
  const leave = await loadStaffMeLeaveRecord(
    ctx.user.businessId,
    ctx.employee.id,
    id,
  );

  if (!leave) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (leave.status !== "pending") {
    return NextResponse.json(
      {
        error: "not_cancellable",
        message: "Only pending leave requests can be cancelled.",
      },
      { status: 409 },
    );
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("hr_leave_records")
    .update({
      status: "rejected",
      decision_note: "Cancelled by employee",
    })
    .eq("id", id)
    .eq("business_id", ctx.user.businessId)
    .eq("employee_id", ctx.employee.id)
    .eq("status", "pending")
    .select(
      "id, employee_id, leave_type, start_date, end_date, reason, status, decision_note, created_at",
    )
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "cancel_failed", message: "Could not cancel leave request." },
      { status: 500 },
    );
  }

  return NextResponse.json({ leave: data }, { status: 200 });
}
