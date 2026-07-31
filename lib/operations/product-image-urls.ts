import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const BUCKET = "admin-files";
const TTL_SECONDS = 60 * 60;

/** Batch-resolve signed image URLs for Operations catalogue file ids. */
export async function resolveProductImageUrls(
  _supabase: SupabaseClient,
  fileIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(fileIds.filter(Boolean))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;

  const admin = createServiceRoleClient();
  const { data: files } = await admin
    .from("admin_files")
    .select("id, storage_path, mime_type")
    .in("id", unique)
    .is("deleted_at", null);

  await Promise.all(
    (files ?? []).map(async (f) => {
      if (!f.mime_type?.startsWith("image/")) return;
      const { data: signed } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(f.storage_path, TTL_SECONDS);
      if (signed?.signedUrl) out.set(f.id, signed.signedUrl);
    }),
  );

  return out;
}
