import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMyr } from "@/lib/finance/schemas";
import { postBusinessNotification } from "@/lib/notifications/post";

function postFinance(
  businessId: string,
  eventType: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  void postBusinessNotification({
    businessId,
    pillar: "finance",
    eventType,
    message,
    meta,
  });
}

export function notifyFinanceTransactionCreated(input: {
  businessId: string;
  kind: "income" | "expense";
  description: string;
  amountMyr: number;
  txnId: string;
}): void {
  const label = input.kind === "income" ? "Income" : "Expense";
  postFinance(
    input.businessId,
    "finance.transaction.created",
    `${label} logged: ${input.description} (${formatMyr(input.amountMyr)})`,
    { txn_id: input.txnId, kind: input.kind },
  );
}

export function notifyFinanceInvoiceCreated(input: {
  businessId: string;
  invoiceId: string;
  number: string;
  customerName: string;
  totalMyr: number;
  documentKind: "invoice" | "quote";
  status: string;
}): void {
  const doc = input.documentKind === "quote" ? "Quote" : "Invoice";
  const statusNote =
    input.status === "sent"
      ? " and marked sent"
      : input.status === "paid"
        ? " and marked paid"
        : "";
  postFinance(
    input.businessId,
    "finance.invoice.created",
    `${doc} ${input.number} for ${input.customerName} (${formatMyr(input.totalMyr)})${statusNote}`,
    {
      invoice_id: input.invoiceId,
      document_kind: input.documentKind,
      status: input.status,
    },
  );
}

export function notifyFinanceInvoiceSent(input: {
  businessId: string;
  invoiceId: string;
  number: string;
  customerName: string;
  totalMyr: number;
}): void {
  postFinance(
    input.businessId,
    "finance.invoice.sent",
    `Invoice ${input.number} sent to ${input.customerName} (${formatMyr(input.totalMyr)})`,
    { invoice_id: input.invoiceId },
  );
}

export function notifyFinanceInvoicePaid(input: {
  businessId: string;
  invoiceId: string;
  number: string;
  customerName: string;
  totalMyr: number;
  via?: "manual" | "billplz";
}): void {
  const via =
    input.via === "billplz" ? " via Billplz" : "";
  postFinance(
    input.businessId,
    "finance.invoice.paid",
    `Invoice ${input.number} paid by ${input.customerName} (${formatMyr(input.totalMyr)})${via}`,
    { invoice_id: input.invoiceId, via: input.via ?? "manual" },
  );
}

export function notifyFinanceInvoiceVoided(input: {
  businessId: string;
  invoiceId: string;
  number: string;
}): void {
  postFinance(
    input.businessId,
    "finance.invoice.voided",
    `Invoice ${input.number} voided`,
    { invoice_id: input.invoiceId },
  );
}

export function notifyFinanceInvoiceEmailed(input: {
  businessId: string;
  invoiceId: string;
  number: string;
  email: string;
}): void {
  postFinance(
    input.businessId,
    "finance.invoice.emailed",
    `Invoice ${input.number} emailed to ${input.email}`,
    { invoice_id: input.invoiceId },
  );
}

export function notifyFinanceQuoteConverted(input: {
  businessId: string;
  quoteNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
}): void {
  postFinance(
    input.businessId,
    "finance.quote.converted",
    `Quote ${input.quoteNumber} converted to invoice ${input.invoiceNumber} for ${input.customerName}`,
    { quote_number: input.quoteNumber, invoice_id: input.invoiceId },
  );
}

export function notifyFinanceExportDownloaded(input: {
  businessId: string;
  month: string;
}): void {
  postFinance(
    input.businessId,
    "finance.export.downloaded",
    `Accountant export pack downloaded for ${input.month}`,
    { month: input.month },
  );
}

export async function notifyFinanceBillplzPaid(
  client: SupabaseClient,
  businessId: string,
  invoiceId: string,
): Promise<void> {
  const { data } = await client
    .from("finance_invoices")
    .select("number, customer_name, total_myr")
    .eq("id", invoiceId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!data) return;

  notifyFinanceInvoicePaid({
    businessId,
    invoiceId,
    number: data.number as string,
    customerName: data.customer_name as string,
    totalMyr: Number(data.total_myr),
    via: "billplz",
  });
}
