import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminInternalNote {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_name: string;
  is_pinned: boolean;
  linked_task_id: string | null;
  linked_compliance_id: string | null;
  linked_task_title: string | null;
  linked_compliance_title: string | null;
}

export async function loadAdminInternalNotes(
  supabase: SupabaseClient,
  businessId: string,
  limit = 50,
): Promise<AdminInternalNote[]> {
  const { data } = await supabase
    .from("admin_internal_notes")
    .select(
      "id, body, created_at, updated_at, created_by, is_pinned, linked_task_id, linked_compliance_id",
    )
    .eq("business_id", businessId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = data ?? [];
  const creatorIds = Array.from(new Set(rows.map((r) => r.created_by)));
  const taskIds = Array.from(
    new Set(
      rows.map((r) => r.linked_task_id).filter(Boolean),
    ),
  ) as string[];
  const complianceIds = Array.from(
    new Set(
      rows.map((r) => r.linked_compliance_id).filter(Boolean),
    ),
  ) as string[];

  const nameLookup = new Map<string, string>();
  const taskLookup = new Map<string, string>();
  const complianceLookup = new Map<string, string>();

  const lookups: Promise<void>[] = [];

  if (creatorIds.length > 0) {
    lookups.push(
      (async () => {
        const { data: profiles } = await supabase
          .from("users")
          .select("id, display_name, email")
          .in("id", creatorIds);
        for (const p of profiles ?? []) {
          nameLookup.set(
            p.id,
            p.display_name?.trim() || p.email || "Team member",
          );
        }
      })(),
    );
  }

  if (taskIds.length > 0) {
    lookups.push(
      (async () => {
        const { data: tasks } = await supabase
          .from("admin_tasks")
          .select("id, title")
          .eq("business_id", businessId)
          .in("id", taskIds);
        for (const t of tasks ?? []) {
          taskLookup.set(t.id, t.title);
        }
      })(),
    );
  }

  if (complianceIds.length > 0) {
    lookups.push(
      (async () => {
        const { data: items } = await supabase
          .from("admin_compliance_items")
          .select("id, title")
          .eq("business_id", businessId)
          .in("id", complianceIds);
        for (const item of items ?? []) {
          complianceLookup.set(item.id, item.title);
        }
      })(),
    );
  }

  await Promise.all(lookups);

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author_name: nameLookup.get(row.created_by) ?? "Team member",
    is_pinned: row.is_pinned,
    linked_task_id: row.linked_task_id,
    linked_compliance_id: row.linked_compliance_id,
    linked_task_title: row.linked_task_id
      ? (taskLookup.get(row.linked_task_id) ?? null)
      : null,
    linked_compliance_title: row.linked_compliance_id
      ? (complianceLookup.get(row.linked_compliance_id) ?? null)
      : null,
  }));
}
