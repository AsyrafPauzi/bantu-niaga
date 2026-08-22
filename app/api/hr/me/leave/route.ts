import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { loadStaffMeLeaveRecords } from "@/lib/hr/load";
import {
  employeeEntitlementDays,
  isLeaveTypeEnabled,
  loadHrLeaveTypeSettings,
} from "@/lib/hr/leave-type-settings";
import type { LeaveTypeKey } from "@/lib/hr/leave-labels";
import { parseStaffLeaveRequest } from "@/lib/hr/parse-staff-leave-request";
import { processLeaveDocumentUpload } from "@/lib/hr/process-leave-document";
import { requireStaffMeContext } from "@/lib/hr/staff-self-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireStaffMeContext();
  if (ctx instanceof NextResponse) return ctx;

  const leave = await loadStaffMeLeaveRecords(
    ctx.user.businessId,
    ctx.employee.id,
  );
  return NextResponse.json({ data: leave }, { status: 200 });
}

export async function POST(request: Request) {
  const ctx = await requireStaffMeContext();
  if (ctx instanceof NextResponse) return ctx;

  let parsed;
  try {
    parsed = await parseStaffLeaveRequest(request);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    throw error;
  }

  const { fields, mcFile } = parsed;

  const admin = createServiceRoleClient();
  const leaveSettings = await loadHrLeaveTypeSettings(admin, ctx.user.businessId);
  if (!isLeaveTypeEnabled(fields.leave_type, leaveSettings)) {
    return NextResponse.json(
      {
        error: "leave_type_disabled",
        message: "That leave type is disabled in leave policy.",
      },
      { status: 400 },
    );
  }

  // Block types with no quota (except unpaid).
  if (fields.leave_type !== "unpaid") {
    const quota = employeeEntitlementDays(
      fields.leave_type as LeaveTypeKey,
      ctx.employee,
      leaveSettings,
    );
    if (quota == null) {
      return NextResponse.json(
        {
          error: "leave_type_not_configured",
          message:
            "That leave type has no quota set. Ask HR to configure it on your profile.",
        },
        { status: 400 },
      );
    }
  }

  const docResult = await processLeaveDocumentUpload(admin, {
    leaveType: fields.leave_type,
    mcFile,
    settings: leaveSettings,
    businessId: ctx.user.businessId,
    uploadedByUserId: ctx.user.id,
  });
  if (!docResult.ok) return docResult.response;
  const mcDocument = docResult.document;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_leave_records")
    .insert({
      ...fields,
      ...mcDocument,
      business_id: ctx.user.businessId,
      employee_id: ctx.employee.id,
      status: "pending",
      requested_by: ctx.user.id,
    })
    .select(
      "id, employee_id, leave_type, start_date, end_date, reason, status, decision_note, created_at, mc_document_name",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "create_failed", message: "Could not submit leave request." },
      { status: 500 },
    );
  }

  return NextResponse.json({ leave: data }, { status: 201 });
}
