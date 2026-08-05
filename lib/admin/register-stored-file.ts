import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const STORAGE_BUCKET = "admin-files";

export interface RegisterStoredFileInput {
  businessId: string;
  uploadedBy: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  description?: string | null;
}

/** Insert an admin_files row for a file already uploaded to the admin-files bucket. */
export async function registerAdminStoredFile(
  admin: SupabaseClient,
  input: RegisterStoredFileInput,
): Promise<string> {
  const { data, error } = await admin
    .from("admin_files")
    .insert({
      business_id: input.businessId,
      uploaded_by: input.uploadedBy,
      storage_path: input.storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      file_size_bytes: input.sizeBytes,
      category: input.category,
      description: input.description ?? null,
      tags: [],
    })
    .select("id")
    .single();

  if (error || !data) {
    void admin.storage.from(STORAGE_BUCKET).remove([input.storagePath]);
    throw new Error(error?.message ?? "Could not register file in Storage vault.");
  }

  return data.id as string;
}
