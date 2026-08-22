import type { SupabaseClient } from "@supabase/supabase-js";
import type { OperationsServiceRow } from "@/lib/operations/schemas";

export interface OperationsServicesSummary {
  total: number;
  active: number;
  inactive: number;
}

export async function loadOperationsServicesPage(
  admin: SupabaseClient,
  businessId: string,
  opts: { page: number; pageSize: number; search?: string },
): Promise<{
  services: OperationsServiceRow[];
  total: number;
  summary: OperationsServicesSummary;
}> {
  const from = (opts.page - 1) * opts.pageSize;
  const to = from + opts.pageSize - 1;

  let query = admin
    .from("operations_services")
    .select(
      "id, business_id, name, description, duration_minutes, price_myr, " +
        "is_active, notes, image_file_id, created_by, created_at, updated_at",
      { count: "exact" },
    )
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (opts.search?.trim()) {
    const safe = opts.search.trim().replace(/[%_\\]/g, "");
    query = query.ilike("name", `%${safe}%`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  // Summary counts across all services (not just this page).
  const { data: allRows } = await admin
    .from("operations_services")
    .select("is_active")
    .eq("business_id", businessId)
    .is("deleted_at", null);

  let active = 0;
  for (const row of allRows ?? []) {
    if (row.is_active) active++;
  }
  const totalAll = allRows?.length ?? 0;

  return {
    services: (data ?? []) as unknown as OperationsServiceRow[],
    total: count ?? 0,
    summary: { total: totalAll, active, inactive: totalAll - active },
  };
}
