import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinanceInvoiceRow } from "@/lib/finance/schemas";

export interface CustomerStatementSummary {
  total_billed_myr: number;
  total_paid_myr: number;
  outstanding_myr: number;
  invoice_count: number;
}

export interface CustomerStatementData {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone_e164: string | null;
    address: string | null;
  };
  invoices: FinanceInvoiceRow[];
  summary: CustomerStatementSummary;
}

export async function loadCustomerStatement(
  supabase: SupabaseClient,
  businessId: string,
  customerId: string,
): Promise<CustomerStatementData | null> {
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, email, phone_e164, address")
    .eq("business_id", businessId)
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!customer) return null;

  const { data: invoices } = await supabase
    .from("finance_invoices")
    .select(
      "id, business_id, number, share_hash, share_issued_at, share_expires_at, customer_id, customer_name, customer_email, " +
        "customer_phone, customer_address, title, description, invoice_date, amount_myr, discount_myr, " +
        "discount_pct, tax_myr, tax_pct, shipping_myr, total_myr, status, due_date, notes, " +
        "paid_at, sent_at, document_kind, show_duitnow, converted_from_id, admin_file_id, created_at, updated_at",
    )
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("document_kind", "invoice")
    .is("deleted_at", null)
    .neq("status", "void")
    .order("invoice_date", { ascending: false });

  const rows = (invoices ?? []) as unknown as FinanceInvoiceRow[];

  let total_billed_myr = 0;
  let total_paid_myr = 0;
  let outstanding_myr = 0;

  for (const inv of rows) {
    const total = Number(inv.total_myr ?? 0);
    total_billed_myr += total;
    if (inv.status === "paid") {
      total_paid_myr += total;
    } else if (inv.status === "sent") {
      outstanding_myr += total;
    }
  }

  return {
    customer: customer as CustomerStatementData["customer"],
    invoices: rows,
    summary: {
      total_billed_myr,
      total_paid_myr,
      outstanding_myr,
      invoice_count: rows.length,
    },
  };
}
