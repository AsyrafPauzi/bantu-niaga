import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SortOrder } from "@/lib/super-admin/table-sort";
import {
  auditMatchesCategory,
  type AuditAdminRow,
  type AuditCategory,
} from "./audit-format";
import { sortAuditRows, type AuditSortField } from "./audit-sort";

export type AuditPageFilters = {
  q?: string;
  category?: AuditCategory;
};

export interface AuditSummary {
  total: number;
  last7d: number;
  userActions: number;
  integrationActions: number;
}

interface RawAuditRow {
  id: string;
  admin_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_business_id: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
}

function mapAuditRow(row: RawAuditRow): AuditAdminRow {
  return {
    id: row.id,
    adminEmail: row.admin_email,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetBusinessId: row.target_business_id,
    diff: row.diff,
    createdAt: row.created_at,
  };
}

export async function loadAuditSummary(): Promise<AuditSummary> {
  const svc = createServiceRoleClient();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    { count: total },
    { count: last7d },
    { count: userActions },
    { count: integrationActions },
  ] = await Promise.all([
    svc.from("super_admin_audit").select("id", { count: "exact", head: true }),
    svc
      .from("super_admin_audit")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since7d),
    svc
      .from("super_admin_audit")
      .select("id", { count: "exact", head: true })
      .like("action", "user.%"),
    svc
      .from("super_admin_audit")
      .select("id", { count: "exact", head: true })
      .like("action", "integration.%"),
  ]);

  return {
    total: total ?? 0,
    last7d: last7d ?? 0,
    userActions: userActions ?? 0,
    integrationActions: integrationActions ?? 0,
  };
}

export async function loadAuditPage(opts: {
  from: number;
  to: number;
  filters?: AuditPageFilters;
  sort?: { field: AuditSortField; order: SortOrder };
}): Promise<{ rows: AuditAdminRow[]; total: number }> {
  const svc = createServiceRoleClient();
  const filters = opts.filters ?? {};
  const sort = opts.sort ?? { field: "when", order: "desc" };
  const category = (filters.category ?? "all") as AuditCategory;

  let query = svc
    .from("super_admin_audit")
    .select(
      "id, admin_email, action, target_type, target_id, target_business_id, diff, created_at",
      { count: "exact" },
    );

  const search = filters.q?.trim();
  if (search) {
    const like = `%${search}%`;
    const { data: bizMatches } = await svc
      .from("businesses")
      .select("id")
      .or(`name.ilike.${like},idcompany.ilike.${like}`);
    const bizIds = (bizMatches ?? []).map((row) => row.id as string);
    const orParts = [
      `admin_email.ilike.${like}`,
      `action.ilike.${like}`,
      `target_type.ilike.${like}`,
    ];
    if (bizIds.length > 0) {
      orParts.push(`target_business_id.in.(${bizIds.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  const { data, error, count } = await query;
  if (error) throw error;

  let rows = ((data ?? []) as RawAuditRow[]).map(mapAuditRow);
  if (category !== "all") {
    rows = rows.filter((row) => auditMatchesCategory(row.action, category));
  }

  const businessIds = [
    ...new Set(
      rows
        .map((row) => row.targetBusinessId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: businesses } =
    businessIds.length > 0
      ? await svc.from("businesses").select("id, name").in("id", businessIds)
      : { data: [] };

  const businessNames = new Map(
    (businesses ?? []).map((row) => [row.id as string, row.name as string]),
  );

  const enriched = rows.map((row) => ({
    ...row,
    businessName: row.targetBusinessId
      ? businessNames.get(row.targetBusinessId)
      : undefined,
  }));

  const sorted = sortAuditRows(enriched, sort);
  const total = category === "all" && !search ? (count ?? sorted.length) : sorted.length;
  const paged = sorted.slice(opts.from, opts.to + 1);
  return { rows: paged, total };
}
