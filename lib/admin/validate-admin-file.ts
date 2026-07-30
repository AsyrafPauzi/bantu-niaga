import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertAdminFileOwned(
  supabase: SupabaseClient,
  businessId: string,
  fileId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("admin_files")
    .select("id")
    .eq("id", fileId)
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function loadAdminFileNames(
  supabase: SupabaseClient,
  businessId: string,
  fileIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(fileIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data } = await supabase
    .from("admin_files")
    .select("id, file_name")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .in("id", unique);

  return new Map(
    (data ?? []).map((row) => [
      (row as { id: string; file_name: string }).id,
      (row as { id: string; file_name: string }).file_name,
    ]),
  );
}

export async function resolveAdminFileIdPatch(
  supabase: SupabaseClient,
  businessId: string,
  fileId: string | null | undefined,
): Promise<{ ok: true; value: string | null } | { ok: false; message: string }> {
  if (fileId === undefined) {
    return { ok: false, message: "admin_file_id is required when patching." };
  }
  if (fileId === null) return { ok: true, value: null };
  const owned = await assertAdminFileOwned(supabase, businessId, fileId);
  if (!owned) {
    return { ok: false, message: "File not found in your business storage." };
  }
  return { ok: true, value: fileId };
}
