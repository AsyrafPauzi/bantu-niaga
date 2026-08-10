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

export interface FinanceInvoicesSummaryFilters {
  customerId?: string;
}

export async function loadFinanceInvoicesSummary(
  supabase: SupabaseClient,
  businessId: string,
  filters?: FinanceInvoicesSummaryFilters,
): Promise<FinanceInvoicesSummary> {
  const today = malaysiaTodayYmd();
  const customerId = filters?.customerId;

  const sentQuery = supabase
    .from("finance_invoices")
    .select("total_myr")
    .eq("business_id", businessId)
    .eq("document_kind", "invoice")
    .eq("status", "sent")
    .is("deleted_at", null);
  if (customerId) sentQuery.eq("customer_id", customerId);

  const draftQuery = supabase
    .from("finance_invoices")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("document_kind", "invoice")
    .eq("status", "draft")
    .is("deleted_at", null);
  if (customerId) draftQuery.eq("customer_id", customerId);

  const sentCountQuery = supabase
    .from("finance_invoices")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("document_kind", "invoice")
    .eq("status", "sent")
    .is("deleted_at", null);
  if (customerId) sentCountQuery.eq("customer_id", customerId);

  const overdueQuery = supabase
    .from("finance_invoices")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("document_kind", "invoice")
    .eq("status", "sent")
    .lt("due_date", today)
    .is("deleted_at", null);
  if (customerId) overdueQuery.eq("customer_id", customerId);

  const paidQuery = supabase
    .from("finance_invoices")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("document_kind", "invoice")
    .eq("status", "paid")
    .is("deleted_at", null);
  if (customerId) paidQuery.eq("customer_id", customerId);

  const quotesQuery = supabase
    .from("finance_invoices")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("document_kind", "quote")
    .in("status", ["draft", "sent"])
    .is("deleted_at", null);
  if (customerId) quotesQuery.eq("customer_id", customerId);

  const invoiceCountQuery = supabase
    .from("finance_invoices")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("document_kind", "invoice")
    .is("deleted_at", null);
  if (customerId) invoiceCountQuery.eq("customer_id", customerId);

  const [
    sentRowsRes,
    draftRes,
    sentRes,
    overdueRes,
    paidRes,
    quotesRes,
    invoiceRes,
  ] = await Promise.all([
    sentQuery,
    draftQuery,
    sentCountQuery,
    overdueQuery,
    paidQuery,
    quotesQuery,
    invoiceCountQuery,
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
