import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { loadStaffMeLeaveRecords } from "@/lib/hr/load";
import {
  storeMcLeaveDocument,
  validateMcDocumentFile,
} from "@/lib/hr/mc-document";
import { parseStaffLeaveRequest } from "@/lib/hr/parse-staff-leave-request";
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
  let mcDocument:
    | {
        mc_document_path: string;
        mc_document_name: string;
        mc_document_mime: string;
        mc_document_size_bytes: number;
      }
    | undefined;

  if (fields.leave_type === "mc") {
    const mcValidation = validateMcDocumentFile(mcFile, { required: true });
    if (!mcValidation.ok) {
      return NextResponse.json(
        { error: "mc_document_invalid", message: mcValidation.message },
        { status: 400 },
      );
    }

    const admin = createServiceRoleClient();
    try {
      const stored = await storeMcLeaveDocument(
        admin,
        ctx.user.businessId,
        mcValidation.file,
        mcValidation.mimeType,
      );
      mcDocument = {
        mc_document_path: stored.path,
        mc_document_name: stored.name,
        mc_document_mime: stored.mime,
        mc_document_size_bytes: stored.size,
      };
    } catch {
      return NextResponse.json(
        {
          error: "mc_upload_failed",
          message: "Could not upload your MC document. Please try again.",
        },
        { status: 500 },
      );
    }
  }

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
