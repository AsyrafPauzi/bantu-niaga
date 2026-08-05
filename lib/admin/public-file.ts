import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { canShareAdminFileCategory } from "@/lib/admin/share";

export interface PublicAdminFile {
  id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  category: string | null;
  description: string | null;
  storage_path: string;
  business: {
    id: string;
    idcompany: string;
    name: string;
  };
}

export async function loadPublicAdminFile(
  idcompany: string,
  shareHash: string,
): Promise<PublicAdminFile | null> {
  const svc = createServiceRoleClient();

  const { data: business } = await svc
    .from("businesses")
    .select("id, idcompany, name")
    .eq("idcompany", idcompany)
    .maybeSingle();

  if (!business) return null;

  const { data: file } = await svc
    .from("admin_files")
    .select(
      "id, file_name, mime_type, file_size_bytes, category, description, storage_path, share_enabled_at",
    )
    .eq("business_id", business.id)
    .eq("share_hash", shareHash)
    .is("deleted_at", null)
    .maybeSingle();

  if (!file?.share_enabled_at) return null;
  if (!canShareAdminFileCategory(file.category)) return null;

  return {
    id: file.id,
    file_name: file.file_name,
    mime_type: file.mime_type,
    file_size_bytes: file.file_size_bytes,
    category: file.category,
    description: file.description,
    storage_path: file.storage_path,
    business: {
      id: business.id,
      idcompany: business.idcompany,
      name: business.name,
    },
  };
}
