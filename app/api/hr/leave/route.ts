import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrLeaveRecords } from "@/lib/hr/load";
import {
  isLeaveTypeEnabled,
  loadHrLeaveTypeSettings,
} from "@/lib/hr/leave-type-settings";
import { parseManagerLeaveRequest } from "@/lib/hr/parse-manager-leave-request";
import { processLeaveDocumentUpload } from "@/lib/hr/process-leave-document";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyHrLeaveRequested } from "@/lib/hr/notify";

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

  const leave = await loadHrLeaveRecords(user.businessId);
  return NextResponse.json({ data: leave }, { status: 200 });
}

export async function POST(request: Request) {
  const { user, response } = await requireHrUser();
  if (response) return response;

  let parsed;
  try {
    parsed = await parseManagerLeaveRequest(request);
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
  const leaveSettings = await loadHrLeaveTypeSettings(admin, user.businessId);
  if (!isLeaveTypeEnabled(fields.leave_type, leaveSettings)) {
    return NextResponse.json(
      {
        error: "leave_type_disabled",
        message: "That leave type is disabled in leave policy.",
      },
      { status: 400 },
    );
  }
  const docResult = await processLeaveDocumentUpload(admin, {
    leaveType: fields.leave_type,
    mcFile,
    settings: leaveSettings,
    businessId: user.businessId,
    uploadedByUserId: user.id,
  });
  if (!docResult.ok) return docResult.response;
  const mcDocument = docResult.document;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_leave_records")
    .insert({
      ...fields,
      ...mcDocument,
      business_id: user.businessId,
      requested_by: user.id,
    })
    .select(
      "id, employee_id, leave_type, start_date, end_date, reason, status, decision_note, created_at, mc_document_name",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "create_failed", message: "Could not create leave record." },
      { status: 500 },
    );
  }

  const { data: employee } = await supabase
    .from("hr_employees")
    .select("full_name")
    .eq("id", data.employee_id)
    .eq("business_id", user.businessId)
    .maybeSingle();

  notifyHrLeaveRequested({
    businessId: user.businessId,
    leaveId: data.id as string,
    employeeName: (employee?.full_name as string) ?? "Employee",
    leaveType: data.leave_type as string,
    startDate: data.start_date as string,
    endDate: data.end_date as string,
  });

  return NextResponse.json({ leave: data }, { status: 201 });
}
