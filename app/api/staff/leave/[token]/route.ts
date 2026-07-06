import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hashLeaveLinkToken, isLeaveLinkUsable } from "@/lib/hr/leave-links";
import {
  storeMcLeaveDocument,
  validateMcDocumentFile,
} from "@/lib/hr/mc-document";
import { parseStaffLeaveRequest } from "@/lib/hr/parse-staff-leave-request";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ token: string }>;
}

interface LeaveLinkRow {
  id: string;
  business_id: string;
  employee_id: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
}

async function loadLink(token: string): Promise<LeaveLinkRow | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("hr_leave_request_links")
    .select("id, business_id, employee_id, expires_at, used_at, revoked_at")
    .eq("token_hash", hashLeaveLinkToken(token))
    .maybeSingle();

  if (error) {
    throw new Error(`leave link lookup failed: ${error.message}`);
  }
  return data as LeaveLinkRow | null;
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const link = await loadLink(token);
  if (!link || !isLeaveLinkUsable(link)) {
    return NextResponse.json(
      {
        error: "link_unavailable",
        message: "This leave link has expired. Please request a new link from your manager.",
      },
      { status: 410 },
    );
  }

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

    const supabase = createServiceRoleClient();
    try {
      const stored = await storeMcLeaveDocument(
        supabase,
        link.business_id,
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

  const supabase = createServiceRoleClient();
  const usedAt = new Date().toISOString();
  const { data: usedLink, error: useError } = await supabase
    .from("hr_leave_request_links")
    .update({ used_at: usedAt })
    .eq("id", link.id)
    .select("id")
    .single();

  if (useError || !usedLink) {
    return NextResponse.json(
      { error: "link_use_failed", message: "Could not use this leave link." },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("hr_leave_records")
    .insert({
      ...fields,
      ...mcDocument,
      business_id: link.business_id,
      employee_id: link.employee_id,
      status: "pending",
      requested_by: null,
    })
    .select(
      "id, employee_id, leave_type, start_date, end_date, reason, status, created_at, mc_document_name",
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
