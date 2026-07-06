import type { SupabaseClient } from "@supabase/supabase-js";
import { computeInvoiceTotals, lineTotal } from "@/lib/finance/invoice-math";
import type {
  FinanceInvoiceItemRow,
  FinanceInvoiceRow,
} from "@/lib/finance/schemas";

export const INVOICE_SELECT =
  "id, business_id, number, share_hash, customer_id, customer_name, customer_email, " +
  "customer_phone, title, description, invoice_date, amount_myr, discount_myr, " +
  "discount_pct, tax_myr, tax_pct, shipping_myr, total_myr, status, due_date, notes, " +
  "paid_at, sent_at, created_at, updated_at";

export const INVOICE_ITEM_SELECT =
  "id, business_id, invoice_id, description, unit_price, quantity, unit, taxable, " +
  "sort_order, line_total_myr";

interface CustomerSnapshot {
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
}

export async function resolveCustomerSnapshot(
  supabase: SupabaseClient,
  businessId: string,
  customerId: string | null | undefined,
  fallback?: {
    customer_name?: string;
    customer_email?: string | null;
    customer_phone?: string | null;
  },
): Promise<CustomerSnapshot> {
  if (customerId) {
    const { data } = await supabase
      .from("customers")
      .select("id, name, email, phone_e164")
      .eq("business_id", businessId)
      .eq("id", customerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (data) {
      const row = data as {
        id: string;
        name: string;
        email: string | null;
        phone_e164: string | null;
      };
      return {
        customer_id: row.id,
        customer_name: row.name,
        customer_email: row.email,
        customer_phone: row.phone_e164,
      };
    }
  }

  return {
    customer_id: customerId ?? null,
    customer_name: fallback?.customer_name?.trim() ?? "",
    customer_email: fallback?.customer_email ?? null,
    customer_phone: fallback?.customer_phone ?? null,
  };
}

export function buildTotalsFromPayload(payload: {
  items?: Array<{
    unit_price: number;
    quantity: number;
    taxable?: boolean;
  }>;
  amount_myr?: number;
  discount_myr?: number;
  discount_pct?: number;
  tax_myr?: number;
  tax_pct?: number;
  shipping_myr?: number;
}) {
  const items =
    payload.items && payload.items.length > 0
      ? payload.items
      : [{ unit_price: payload.amount_myr ?? 0, quantity: 1, taxable: false }];

  return computeInvoiceTotals({
    items,
    discount_myr: payload.discount_myr,
    discount_pct: payload.discount_pct,
    tax_myr: payload.tax_myr,
    tax_pct: payload.tax_pct,
    shipping_myr: payload.shipping_myr,
  });
}

export async function loadInvoiceWithItems(
  supabase: SupabaseClient,
  businessId: string,
  invoiceId: string,
): Promise<FinanceInvoiceRow | null> {
  const { data: invoice } = await supabase
    .from("finance_invoices")
    .select(INVOICE_SELECT)
    .eq("business_id", businessId)
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!invoice) return null;

  const { data: items } = await supabase
    .from("finance_invoice_items")
    .select(INVOICE_ITEM_SELECT)
    .eq("business_id", businessId)
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });

  return {
    ...(invoice as unknown as FinanceInvoiceRow),
    items: (items ?? []) as unknown as FinanceInvoiceItemRow[],
  };
}

export async function replaceInvoiceItems(
  supabase: SupabaseClient,
  businessId: string,
  invoiceId: string,
  items: Array<{
    description: string;
    unit_price: number;
    quantity: number;
    unit?: string | null;
    taxable?: boolean;
  }>,
): Promise<void> {
  await supabase
    .from("finance_invoice_items")
    .delete()
    .eq("business_id", businessId)
    .eq("invoice_id", invoiceId);

  if (items.length === 0) return;

  const rows = items.map((item, index) => ({
    business_id: businessId,
    invoice_id: invoiceId,
    description: item.description,
    unit_price: item.unit_price,
    quantity: item.quantity,
    unit: item.unit ?? null,
    taxable: item.taxable ?? false,
    sort_order: index,
    line_total_myr: lineTotal(item.unit_price, item.quantity),
  }));

  const { error } = await supabase.from("finance_invoice_items").insert(rows);
  if (error) throw new Error(error.message);
}
