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
  const { data: invoices } = await supabase
    .from("finance_invoices")
    .select("customer_id, created_at")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .not("customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(40);

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of invoices ?? []) {
    const id = row.customer_id as string;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) break;
  }

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
