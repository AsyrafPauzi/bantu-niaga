import "server-only";

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  leaveTypeRequiresAttachment,
  type HrLeaveTypeSettingRow,
} from "@/lib/hr/leave-type-settings";
import {
  storeMcLeaveDocument,
  validateMcDocumentFile,
} from "@/lib/hr/mc-document";

export interface LeaveDocumentFields {
  mc_document_path: string;
  mc_document_name: string;
  mc_document_mime: string;
  mc_document_size_bytes: number;
  admin_file_id: string;
}

type ProcessLeaveDocumentResult =
  | { ok: true; document?: LeaveDocumentFields }
  | { ok: false; response: NextResponse };

export async function processLeaveDocumentUpload(
  supabase: SupabaseClient,
  options: {
    leaveType: string;
    mcFile: File | null;
    settings: readonly HrLeaveTypeSettingRow[];
    businessId: string;
    uploadedByUserId: string;
    /** When true, store a provided file even if the leave type does not require it (edit re-upload). */
    allowOptionalUpload?: boolean;
  },
): Promise<ProcessLeaveDocumentResult> {
  const required = leaveTypeRequiresAttachment(
    options.leaveType,
    options.settings,
  );

  if (!required && !options.allowOptionalUpload) {
    return { ok: true };
  }

  // Edit re-upload: skip when no new file is provided.
  if (options.allowOptionalUpload && !options.mcFile) {
    return { ok: true };
  }

  const mcValidation = validateMcDocumentFile(options.mcFile, {
    required: !options.allowOptionalUpload && required,
  });
  if (!mcValidation.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "mc_document_invalid", message: mcValidation.message },
        { status: 400 },
      ),
    };
  }

  try {
    const stored = await storeMcLeaveDocument(
      supabase,
      options.businessId,
      options.uploadedByUserId,
      mcValidation.file,
      mcValidation.mimeType,
    );
    return {
      ok: true,
      document: {
        mc_document_path: stored.path,
        mc_document_name: stored.name,
        mc_document_mime: stored.mime,
        mc_document_size_bytes: stored.size,
        admin_file_id: stored.admin_file_id,
      },
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "mc_upload_failed",
          message: "Could not upload the supporting document. Please try again.",
        },
        { status: 500 },
      ),
    };
  }
}
