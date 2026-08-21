import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadInvoiceWithItems } from "@/lib/finance/invoice-db";
import type { OperationsProductPickerRow } from "@/lib/finance/invoice-composer-shared";
import type {
  FinanceCustomerRow,
  FinanceDocumentKind,
  FinanceInvoiceRow,
} from "@/lib/finance/schemas";

export type { OperationsProductPickerRow } from "@/lib/finance/invoice-composer-shared";

export async function loadRecentBilledCustomers(
  supabase: SupabaseClient,
  businessId: string,
  limit = 5,
): Promise<FinanceCustomerRow[]> {
  // Pull a wider window of invoices so we can rank by transaction count.
  const { data: invoices } = await supabase
    .from("finance_invoices")
    .select("customer_id")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .not("customer_id", "is", null)
    .limit(500);

  // Tally transaction count per customer, then pick the top `limit`.
  const counts = new Map<string, number>();
  for (const row of invoices ?? []) {
    const id = row.customer_id as string;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const ids = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (ids.length === 0) return [];

  const { data: customers } = await supabase
    .from("customers")
    .select(
      "id, business_id, name, phone_e164, email, address, notes, created_at, updated_at",
    )
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .in("id", ids);

  const byId = new Map(
    ((customers ?? []) as unknown as FinanceCustomerRow[]).map((c) => [c.id, c]),
  );
  // Return in descending transaction-count order.
  return ids.map((id) => byId.get(id)).filter(Boolean) as FinanceCustomerRow[];
}

export async function loadLastInvoiceForCustomer(
  supabase: SupabaseClient,
  businessId: string,
  customerId: string,
  documentKind?: FinanceDocumentKind,
): Promise<FinanceInvoiceRow | null> {
  let query = supabase
    .from("finance_invoices")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .limit(1);

  if (documentKind) {
    query = query.eq("document_kind", documentKind);
  }

  const { data } = await query.maybeSingle();
  if (!data?.id) return null;

  return loadInvoiceWithItems(supabase, businessId, data.id as string);
}

export async function loadOperationsProductsForFinance(
  supabase: SupabaseClient,
  businessId: string,
): Promise<OperationsProductPickerRow[]> {
  const { data } = await supabase
    .from("operations_products")
    .select("id, name, price_myr, sku")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(200);

  return ((data ?? []) as OperationsProductPickerRow[]).map((p) => ({
    ...p,
    price_myr: Number(p.price_myr),
  }));
}
