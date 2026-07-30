import type { SupabaseClient } from "@supabase/supabase-js";
import { malaysiaTodayYmd } from "@/lib/sales/schemas";

export interface FinanceInvoicesSummary {
  outstanding_myr: number;
  draft_count: number;
  sent_count: number;
  overdue_count: number;
  paid_count: number;
  quote_count: number;
  invoice_count: number;
}

export async function loadFinanceInvoicesSummary(
  supabase: SupabaseClient,
  businessId: string,
): Promise<FinanceInvoicesSummary> {
  const today = malaysiaTodayYmd();

  const [
    sentRowsRes,
    draftRes,
    sentRes,
    overdueRes,
    paidRes,
    quotesRes,
    invoiceRes,
  ] = await Promise.all([
    supabase
      .from("finance_invoices")
      .select("total_myr")
      .eq("business_id", businessId)
      .eq("document_kind", "invoice")
      .eq("status", "sent")
      .is("deleted_at", null),
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("document_kind", "invoice")
      .eq("status", "draft")
      .is("deleted_at", null),
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("document_kind", "invoice")
      .eq("status", "sent")
      .is("deleted_at", null),
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("document_kind", "invoice")
      .eq("status", "sent")
      .lt("due_date", today)
      .is("deleted_at", null),
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("document_kind", "invoice")
      .eq("status", "paid")
      .is("deleted_at", null),
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("document_kind", "quote")
      .in("status", ["draft", "sent"])
      .is("deleted_at", null),
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("document_kind", "invoice")
      .is("deleted_at", null),
  ]);

  const outstanding_myr = (sentRowsRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.total_myr ?? 0),
    0,
  );

  return {
    outstanding_myr,
    draft_count: draftRes.count ?? 0,
    sent_count: sentRes.count ?? 0,
    overdue_count: overdueRes.count ?? 0,
    paid_count: paidRes.count ?? 0,
    quote_count: quotesRes.count ?? 0,
    invoice_count: invoiceRes.count ?? 0,
  };
}
