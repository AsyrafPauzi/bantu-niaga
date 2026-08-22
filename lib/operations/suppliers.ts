import type { SupabaseClient } from "@supabase/supabase-js";
import type { OperationsSupplierRow } from "@/lib/operations/schemas";

export interface OperationsSuppliersSummary {
  total: number;
  reachable: number;
  with_terms: number;
  with_contract: number;
}

const SUPPLIER_SELECT =
  "id, business_id, name, contact_name, phone, email, address, " +
  "payment_terms, notes, admin_file_id, created_by, created_at, updated_at";

export async function loadOperationsSuppliersPage(
  admin: SupabaseClient,
  businessId: string,
  opts: { page: number; pageSize: number; search?: string },
): Promise<{
  suppliers: OperationsSupplierRow[];
  total: number;
  summary: OperationsSuppliersSummary;
}> {
  const from = (opts.page - 1) * opts.pageSize;
  const to = from + opts.pageSize - 1;

  let query = admin
    .from("operations_suppliers")
    .select(SUPPLIER_SELECT, { count: "exact" })
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (opts.search?.trim()) {
    const safe = opts.search.trim().replace(/[%_\\]/g, "");
    query = query.or(
      `name.ilike.%${safe}%,contact_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%,payment_terms.ilike.%${safe}%`,
    );
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  const { data: allRows } = await admin
    .from("operations_suppliers")
    .select("phone, email, payment_terms, admin_file_id")
    .eq("business_id", businessId)
    .is("deleted_at", null);

  let reachable = 0;
  let with_terms = 0;
  let with_contract = 0;
  for (const row of allRows ?? []) {
    if (
      (typeof row.phone === "string" && row.phone.trim()) ||
      (typeof row.email === "string" && row.email.trim())
    ) {
      reachable++;
    }
    if (typeof row.payment_terms === "string" && row.payment_terms.trim()) {
      with_terms++;
    }
    if (row.admin_file_id) with_contract++;
  }

  return {
    suppliers: (data ?? []) as unknown as OperationsSupplierRow[],
    total: count ?? 0,
    summary: {
      total: allRows?.length ?? 0,
      reachable,
      with_terms,
      with_contract,
    },
  };
}
