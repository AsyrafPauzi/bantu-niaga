import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface NoteLinkOption {
  id: string;
  kind: "task" | "compliance";
  label: string;
}

export async function loadNoteLinkOptions(
  supabase: SupabaseClient,
  businessId: string,
): Promise<NoteLinkOption[]> {
  const [tasksRes, complianceRes] = await Promise.all([
    supabase
      .from("admin_tasks")
      .select("id, title")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("admin_compliance_items")
      .select("id, title")
      .eq("business_id", businessId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("expires_on", { ascending: true })
      .limit(40),
  ]);

  const tasks: NoteLinkOption[] = (tasksRes.data ?? []).map((row) => ({
    id: row.id,
    kind: "task" as const,
    label: row.title,
  }));

  const compliance: NoteLinkOption[] = (complianceRes.data ?? []).map(
    (row) => ({
      id: row.id,
      kind: "compliance" as const,
      label: row.title,
    }),
  );

  return [...tasks, ...compliance];
}
