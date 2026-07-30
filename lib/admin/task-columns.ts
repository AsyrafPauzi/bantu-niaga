import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_TASK_COLUMNS,
  type AdminTaskColumn,
} from "@/lib/admin/task-columns-shared";

export {
  ADMIN_TASK_COLUMN_MAX,
  ADMIN_TASK_COLUMN_MIN,
  ADMIN_TASK_COLUMN_LABEL_MAX,
  DEFAULT_TASK_COLUMNS,
  adminTaskColumnCreateSchema,
  adminTaskColumnUpdateSchema,
  adminTaskColumnDeleteSchema,
  slugifyTaskColumnLabel,
  columnShellStyle,
  type AdminTaskColumn,
} from "@/lib/admin/task-columns-shared";

export async function ensureDefaultTaskColumns(
  supabase: SupabaseClient,
  businessId: string,
): Promise<void> {
  const { count, error: countErr } = await supabase
    .from("admin_task_columns")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("deleted_at", null);

  if (countErr) throw new Error(countErr.message);
  if ((count ?? 0) > 0) return;

  const { error } = await supabase.from("admin_task_columns").insert(
    DEFAULT_TASK_COLUMNS.map((col) => ({
      business_id: businessId,
      ...col,
    })),
  );
  if (error) throw new Error(error.message);
}

export async function loadTaskColumns(
  supabase: SupabaseClient,
  businessId: string,
): Promise<AdminTaskColumn[]> {
  await ensureDefaultTaskColumns(supabase, businessId);

  const { data, error } = await supabase
    .from("admin_task_columns")
    .select(
      "id, business_id, label, slug, sort_order, is_done, created_at, updated_at",
    )
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminTaskColumn[];
}

export async function getTaskColumnIsDone(
  supabase: SupabaseClient,
  businessId: string,
  columnId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("admin_task_columns")
    .select("is_done")
    .eq("id", columnId)
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.is_done ?? false;
}
