import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminDocumentTemplate } from "@/lib/admin/template-shared";

export type { AdminDocumentTemplate };
export {
  templateCategories,
  templateCategoryLabel,
  templatePreviewLine,
} from "@/lib/admin/template-shared";

export async function loadAdminDocumentTemplates(
  supabase: SupabaseClient,
  businessId: string,
): Promise<AdminDocumentTemplate[]> {
  const { data } = await supabase
    .from("admin_document_templates")
    .select("id, slug, title, category, body_text, sort_order, business_id")
    .or(`business_id.is.null,business_id.eq.${businessId}`)
    .order("sort_order", { ascending: true });

  return (data ?? []) as AdminDocumentTemplate[];
}
