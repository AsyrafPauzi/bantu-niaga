import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitiseAdminFileName } from "@/lib/admin/schemas";

export {
  MC_DOCUMENT_MAX_BYTES,
  MC_DOCUMENT_MAX_SIZE_LABEL,
  validateMcDocumentFile,
} from "@/lib/hr/mc-document-shared";

const MC_STORAGE_BUCKET = "admin-files";

export interface McDocumentMeta {
  path: string;
  name: string;
  mime: string;
  size: number;
}

export async function storeMcLeaveDocument(
  admin: SupabaseClient,
  businessId: string,
  file: File,
  mimeType: string,
): Promise<McDocumentMeta> {
  const safeName = sanitiseAdminFileName(file.name);
  const storagePath = `${businessId}/hr-mc/${randomUUID()}/${safeName}`;
  const bytes = await file.arrayBuffer();

  const { error } = await admin.storage
    .from(MC_STORAGE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`MC upload failed: ${error.message}`);
  }

  return {
    path: storagePath,
    name: safeName,
    mime: mimeType,
    size: file.size,
  };
}
