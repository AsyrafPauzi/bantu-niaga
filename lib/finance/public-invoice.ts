import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface PublicFinanceInvoiceItem {
  description: string;
  unit_price: number;
  quantity: number;
  unit: string | null;
  line_total_myr: number;
}

export interface PublicFinanceInvoice {
  id: string;
  number: string;
  share_hash: string;
  customer_name: string;
  title: string | null;
  description: string | null;
  invoice_date: string | null;
  amount_myr: number;
  discount_myr: number;
  tax_myr: number;
  shipping_myr: number;
  total_myr: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  items: PublicFinanceInvoiceItem[];
  business: {
    id: string;
    idcompany: string;
    name: string;
    duitnow_id: string | null;
    sst_enabled: boolean;
    sst_rate_pct: number;
  };
}

export async function loadPublicFinanceInvoice(
  idcompany: string,
  shareHash: string,
): Promise<PublicFinanceInvoice | null> {
  const admin = createServiceRoleClient();

  const { data: business } = await admin
    .from("businesses")
    .select(
      "id, idcompany, name, duitnow_id, sst_enabled, sst_rate_pct",
    )
    .eq("idcompany", idcompany)
    .maybeSingle();

  if (!business) return null;

  const biz = business as PublicFinanceInvoice["business"] & { id: string };

  const { data: invoice } = await admin
    .from("finance_invoices")
    .select(
      "id, number, share_hash, customer_name, title, description, invoice_date, " +
        "amount_myr, discount_myr, tax_myr, shipping_myr, total_myr, status, " +
        "due_date, paid_at, notes",
    )
    .eq("business_id", biz.id)
    .eq("share_hash", shareHash)
    .is("deleted_at", null)
    .neq("status", "void")
    .maybeSingle();

  if (!invoice) return null;

  const row = invoice as unknown as Omit<PublicFinanceInvoice, "business" | "items">;

  const { data: items } = await admin
    .from("finance_invoice_items")
    .select("description, unit_price, quantity, unit, line_total_myr")
    .eq("business_id", biz.id)
    .eq("invoice_id", row.id)
    .order("sort_order", { ascending: true });

  return {
    ...row,
    discount_myr: Number(row.discount_myr ?? 0),
    shipping_myr: Number(row.shipping_myr ?? 0),
    items: (items ?? []) as unknown as PublicFinanceInvoiceItem[],
    business: biz,
  };
}
