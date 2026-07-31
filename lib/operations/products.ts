import type { SupabaseClient } from "@supabase/supabase-js";
import type { OperationsProductRow } from "@/lib/operations/schemas";

export interface OperationsProductsSummary {
  total: number;
  active: number;
  low_stock: number;
  with_stock: number;
}

export async function loadOperationsProductsPage(
  admin: SupabaseClient,
  businessId: string,
  opts: { page: number; pageSize: number; search?: string; category?: string; lowStockOnly?: boolean },
): Promise<{
  products: OperationsProductRow[];
  total: number;
  summary: OperationsProductsSummary;
  categories: string[];
}> {
  const from = (opts.page - 1) * opts.pageSize;
  const to = from + opts.pageSize - 1;

  let query = admin
    .from("operations_products")
    .select(
      "id, business_id, sku, name, description, category, price_myr, is_active, stock_qty, low_stock_threshold, notes, image_file_id, created_by, created_at, updated_at",
      { count: "exact" },
    )
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (opts.search?.trim()) {
    const safe = opts.search.trim().replace(/[%_\\]/g, "");
    query = query.or(
      `name.ilike.%${safe}%,sku.ilike.%${safe}%,category.ilike.%${safe}%`,
    );
  }

  if (opts.category && opts.category !== "all") {
    query = query.eq("category", opts.category);
  }

  if (opts.lowStockOnly) {
    const { data: allRows, error: allError } = await query;
    if (allError) throw allError;
    const filtered = ((allRows ?? []) as OperationsProductRow[]).filter((r) => {
      if (r.stock_qty == null) return false;
      return r.stock_qty <= (r.low_stock_threshold ?? 5);
    });
    const pageRows = filtered.slice(from, to + 1);
    return buildProductsPageResult(admin, businessId, pageRows, filtered.length);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  return buildProductsPageResult(
    admin,
    businessId,
    (data ?? []) as OperationsProductRow[],
    count ?? 0,
  );
}

async function buildProductsPageResult(
  admin: SupabaseClient,
  businessId: string,
  products: OperationsProductRow[],
  total: number,
) {
  const { data: allForSummary } = await admin
    .from("operations_products")
    .select("is_active, stock_qty, low_stock_threshold, category")
    .eq("business_id", businessId)
    .is("deleted_at", null);

  let active = 0;
  let low_stock = 0;
  let with_stock = 0;
  const categorySet = new Set<string>();
  for (const row of allForSummary ?? []) {
    if (row.is_active) active++;
    if (row.stock_qty != null) {
      with_stock++;
      const threshold = (row.low_stock_threshold as number) ?? 5;
      if ((row.stock_qty as number) <= threshold) low_stock++;
    }
    const cat = (row.category as string | null)?.trim();
    if (cat) categorySet.add(cat);
  }

  return {
    products,
    total,
    summary: {
      total: allForSummary?.length ?? 0,
      active,
      low_stock,
      with_stock,
    },
    categories: Array.from(categorySet).sort((a, b) => a.localeCompare(b)),
  };
}
