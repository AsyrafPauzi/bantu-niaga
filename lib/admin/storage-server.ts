import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminFileSort } from "@/lib/admin/schemas";
import {
  decodeStorageCursor,
  encodeStorageCursor,
  type StorageListCursor,
} from "@/lib/admin/storage-cursor";

export type { AdminFileSort };

export interface AdminFileListRow {
  id: string;
  business_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  category: string | null;
  description: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  share_hash: string | null;
  share_enabled_at: string | null;
}

export interface ListAdminFilesOptions {
  businessId: string;
  category?: string | null;
  q?: string;
  sort?: AdminFileSort;
  limit?: number;
  cursor?: string | null;
}

export interface ListAdminFilesResult {
  rows: AdminFileListRow[];
  nextCursor: string | null;
}

const SELECT_COLS =
  "id, business_id, uploaded_by, storage_path, file_name, mime_type, " +
  "file_size_bytes, category, description, tags, created_at, updated_at, " +
  "share_hash, share_enabled_at";

function buildNextCursor(
  sort: AdminFileSort,
  row: AdminFileListRow,
): string {
  if (sort === "largest") {
    return encodeStorageCursor({
      sort: "largest",
      file_size_bytes: row.file_size_bytes,
      id: row.id,
    });
  }
  if (sort === "name") {
    return encodeStorageCursor({
      sort: "name",
      file_name: row.file_name,
      id: row.id,
    });
  }
  return encodeStorageCursor({
    sort: "newest",
    created_at: row.created_at,
    id: row.id,
  });
}

export async function listAdminFiles(
  supabase: SupabaseClient,
  options: ListAdminFilesOptions,
): Promise<ListAdminFilesResult> {
  const sort = options.sort ?? "newest";
  const limit = options.limit ?? 50;

   
  let q: any = supabase
    .from("admin_files")
    .select(SELECT_COLS)
    .eq("business_id", options.businessId)
    .is("deleted_at", null);

  if (sort === "largest") {
    q = q.order("file_size_bytes", { ascending: false }).order("id", { ascending: false });
  } else if (sort === "name") {
    q = q.order("file_name", { ascending: true }).order("id", { ascending: true });
  } else {
    q = q.order("created_at", { ascending: false }).order("id", { ascending: false });
  }

  if (options.category) {
    q = q.eq("category", options.category);
  }
  if (options.q) {
    const safe = options.q.replace(/[\\*,()]/g, "");
    q = q.ilike("file_name", `%${safe}%`);
  }

  if (options.cursor) {
    const decoded = decodeStorageCursor(options.cursor, sort);
    if (decoded) {
      if (sort === "newest" && decoded.sort === "newest") {
        q = q.or(
          `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`,
        );
      } else if (sort === "largest" && decoded.sort === "largest") {
        q = q.or(
          `file_size_bytes.lt.${decoded.file_size_bytes},and(file_size_bytes.eq.${decoded.file_size_bytes},id.lt.${decoded.id})`,
        );
      } else if (sort === "name" && decoded.sort === "name") {
        const safeName = decoded.file_name.replace(/[\\*,()]/g, "");
        q = q.or(
          `file_name.gt.${safeName},and(file_name.eq.${safeName},id.gt.${decoded.id})`,
        );
      }
    }
  }

  q = q.limit(limit + 1);

  const { data, error } = await q;
  if (error) throw error;

  const allRows = (data ?? []) as unknown as AdminFileListRow[];
  const hasNext = allRows.length > limit;
  const pageRows = hasNext ? allRows.slice(0, limit) : allRows;
  const last = pageRows[pageRows.length - 1];

  return {
    rows: pageRows.map((r) => ({
      ...r,
      tags: Array.isArray(r.tags) ? r.tags : [],
    })),
    nextCursor: hasNext && last ? buildNextCursor(sort, last) : null,
  };
}

export async function hydrateUploaderNames(
  supabase: SupabaseClient,
  rows: AdminFileListRow[],
): Promise<Map<string, string | null>> {
  const uploaderIds = Array.from(new Set(rows.map((r) => r.uploaded_by)));
  const nameLookup = new Map<string, string | null>();
  if (uploaderIds.length === 0) return nameLookup;

  const { data: profiles } = await supabase
    .from("users")
    .select("id, display_name, email")
    .in("id", uploaderIds);

  for (const p of (profiles ?? []) as Array<{
    id: string;
    display_name: string | null;
    email: string | null;
  }>) {
    nameLookup.set(p.id, p.display_name || p.email);
  }
  return nameLookup;
}
