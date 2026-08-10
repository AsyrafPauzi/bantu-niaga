import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { writeAuditLog } from "@/lib/audit/log";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import {
  adjustAnnualLeaveApproval,
  reverseAnnualLeaveApproval,
} from "@/lib/hr/leave-balance";
import {
  isLeaveTypeEnabled,
  loadHrLeaveTypeSettings,
} from "@/lib/hr/leave-type-settings";
import { processLeaveDocumentUpload } from "@/lib/hr/process-leave-document";
import { leaveUpdateSchema } from "@/lib/hr/schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
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

async function parseLeaveUpdate(request: Request): Promise<{
  fields: ReturnType<typeof leaveUpdateSchema.parse>;
  mcFile: File | null;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const mcEntry = formData.get("mc_document");
    const mcFile =
      mcEntry instanceof File && mcEntry.size > 0 ? mcEntry : null;
    const reasonRaw = formData.get("reason");
    const fields = leaveUpdateSchema.parse({
      leave_type: formData.get("leave_type") || undefined,
      start_date: formData.get("start_date") || undefined,
      end_date: formData.get("end_date") || undefined,
      reason:
        reasonRaw === null || reasonRaw === undefined
          ? undefined
          : String(reasonRaw).trim() || null,
    });
    return { fields, mcFile };
  }

  const body = await request.json();
  return { fields: leaveUpdateSchema.parse(body), mcFile: null };
}

export async function PATCH(request: Request, context: RouteContext) {
  const { user, response } = await requireHrUser();
  if (response) return response;

  const { id } = await context.params;
  let parsed;
  let mcFile: File | null = null;
  try {
    const result = await parseLeaveUpdate(request);
    parsed = result.fields;
    mcFile = result.mcFile;
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

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("hr_leave_records")
    .select(
      "id, employee_id, leave_type, start_date, end_date, reason, status, hr_employees(annual_leave_entitlement_days)",
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

  const newStart = parsed.start_date ?? String(existing.start_date);
  const newEnd = parsed.end_date ?? String(existing.end_date);
  const newType = parsed.leave_type ?? String(existing.leave_type);

  const admin = createServiceRoleClient();
  const leaveSettings = await loadHrLeaveTypeSettings(admin, user.businessId);
  if (
    parsed.leave_type !== undefined &&
    !isLeaveTypeEnabled(parsed.leave_type, leaveSettings)
  ) {
    return NextResponse.json(
      {
        error: "leave_type_disabled",
        message: "That leave type is disabled in leave policy.",
      },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (parsed.leave_type !== undefined) patch.leave_type = parsed.leave_type;
  if (parsed.start_date !== undefined) patch.start_date = parsed.start_date;
  if (parsed.end_date !== undefined) patch.end_date = parsed.end_date;
  if (parsed.reason !== undefined) patch.reason = parsed.reason;

  if (mcFile) {
    const docResult = await processLeaveDocumentUpload(admin, {
      leaveType: newType,
      mcFile,
      settings: leaveSettings,
      businessId: user.businessId,
      uploadedByUserId: user.id,
      allowOptionalUpload: true,
    });
    if (!docResult.ok) return docResult.response;
    if (docResult.document) {
      Object.assign(patch, docResult.document);
    }
  }

  let balanceWarning = null;
  if (
    existing.status === "approved" &&
    existing.leave_type === "annual" &&
    newType === "annual"
  ) {
    const entitlement = Number(
      (existing.hr_employees as { annual_leave_entitlement_days?: number } | null)
        ?.annual_leave_entitlement_days ?? 8,
    );
    const result = await adjustAnnualLeaveApproval(supabase, {
      businessId: user.businessId,
      employeeId: existing.employee_id as string,
      oldStartDate: String(existing.start_date),
      oldEndDate: String(existing.end_date),
      newStartDate: newStart,
      newEndDate: newEnd,
      entitlementDays: entitlement,
    });
    balanceWarning = result.warning;
  }

  const { data, error } = await supabase
    .from("hr_leave_records")
    .update(patch)
    .eq("business_id", user.businessId)
    .eq("id", id)
    .select(
      "id, employee_id, leave_type, start_date, end_date, reason, status, decision_note, created_at, mc_document_name",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "update_failed", message: "Could not update leave record." },
      { status: 500 },
    );
  }

  await writeAuditLog(supabase, {
    businessId: user.businessId,
    actorUserId: user.id,
    action: "hr.leave.update",
    entityType: "hr_leave_records",
    entityId: id,
    diff: patch,
  });

  return NextResponse.json(
    { leave: data, balance_warning: balanceWarning },
    { status: 200 },
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { user, response } = await requireHrUser();
  if (response) return response;

  const { id } = await context.params;
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

  if (existing.status === "approved" && existing.leave_type === "annual") {
    const entitlement = Number(
      (existing.hr_employees as { annual_leave_entitlement_days?: number } | null)
        ?.annual_leave_entitlement_days ?? 8,
    );
    await reverseAnnualLeaveApproval(supabase, {
      businessId: user.businessId,
      employeeId: existing.employee_id as string,
      startDate: String(existing.start_date),
      endDate: String(existing.end_date),
      entitlementDays: entitlement,
    });
  }

  const { error } = await supabase
    .from("hr_leave_records")
    .delete()
    .eq("business_id", user.businessId)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "delete_failed", message: "Could not delete leave record." },
      { status: 500 },
    );
  }

  await writeAuditLog(supabase, {
    businessId: user.businessId,
    actorUserId: user.id,
    action: "hr.leave.delete",
    entityType: "hr_leave_records",
    entityId: id,
    diff: {
      leave_type: existing.leave_type,
      start_date: existing.start_date,
      end_date: existing.end_date,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
