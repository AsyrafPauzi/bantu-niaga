import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTaskColumns } from "@/lib/admin/task-columns";
import type { AdminTaskRow } from "@/lib/admin/task-compliance-schemas";

export async function enrichAdminTasks(
  supabase: SupabaseClient,
  businessId: string,
  rows: AdminTaskRow[],
): Promise<AdminTaskRow[]> {
  const columns = await loadTaskColumns(supabase, businessId);
  const columnMap = new Map(columns.map((c) => [c.id, c]));

  const assigneeIds = Array.from(
    new Set(rows.map((r) => r.assignee_user_id).filter(Boolean)),
  ) as string[];

  const fileIds = Array.from(
    new Set(rows.map((r) => r.admin_file_id).filter(Boolean)),
  ) as string[];

  const nameLookup = new Map<string, string | null>();
  const fileNameLookup = new Map<string, string | null>();

  if (assigneeIds.length > 0) {
    const { data: profiles } = await supabase
      .from("users")
      .select("id, display_name, email")
      .in("id", assigneeIds);
    for (const p of (profiles ?? []) as Array<{
      id: string;
      display_name: string | null;
      email: string | null;
    }>) {
      nameLookup.set(p.id, p.display_name || p.email);
    }
  }

  if (fileIds.length > 0) {
    const { data: files } = await supabase
      .from("admin_files")
      .select("id, file_name")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .in("id", fileIds);
    for (const f of (files ?? []) as Array<{ id: string; file_name: string }>) {
      fileNameLookup.set(f.id, f.file_name);
    }
  }

  return rows.map((r) => {
    const col = columnMap.get(r.column_id);
    return {
      ...r,
      assignee_name: r.assignee_user_id
        ? (nameLookup.get(r.assignee_user_id) ?? null)
        : null,
      column_label: col?.label ?? null,
      column_is_done: col?.is_done ?? false,
      admin_file_name: r.admin_file_id
        ? (fileNameLookup.get(r.admin_file_id) ?? null)
        : null,
    };
  });
}

export async function resolveDefaultTaskColumnId(
  supabase: SupabaseClient,
  businessId: string,
): Promise<string> {
  const columns = await loadTaskColumns(supabase, businessId);
  const openCol = columns.find((c) => !c.is_done);
  const col = openCol ?? columns[0];
  if (!col) throw new Error("No task columns configured.");
  return col.id;
}

export async function columnIsDone(
  supabase: SupabaseClient,
  businessId: string,
  columnId: string,
): Promise<boolean> {
  const columns = await loadTaskColumns(supabase, businessId);
  return columns.find((c) => c.id === columnId)?.is_done ?? false;
}
