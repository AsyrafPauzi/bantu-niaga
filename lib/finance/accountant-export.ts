import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { toCsv } from "@/lib/marketing/csv";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Inclusive YYYY-MM-DD bounds for txn_date / invoice_date columns. */
export function financeMonthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) {
    throw new Error("Use month=YYYY-MM.");
  }
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export async function buildAccountantExportCsv(
  businessId: string,
  month: string,
  client?: SupabaseClient,
): Promise<string> {
  const supabase = client ?? (await createSupabaseServerClient());
  const { start, end } = financeMonthBounds(month);

  const [invoicesRes, txnsRes] = await Promise.all([
    supabase
      .from("finance_invoices")
      .select(
        "number, invoice_date, customer_name, status, amount_myr, tax_myr, total_myr, paid_at, document_kind",
      )
      .eq("business_id", businessId)
      .eq("document_kind", "invoice")
      .is("deleted_at", null)
      .gte("invoice_date", start)
      .lte("invoice_date", end)
      .order("invoice_date", { ascending: true }),
    supabase
      .from("finance_transactions")
      .select(
        "txn_date, kind, category, description, counterparty, amount_myr, payment_method",
      )
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .gte("txn_date", start)
      .lte("txn_date", end)
      .order("txn_date", { ascending: true }),
  ]);

  if (invoicesRes.error) throw new Error(invoicesRes.error.message);
  if (txnsRes.error) throw new Error(txnsRes.error.message);

  const invoices = invoicesRes.data ?? [];
  const txns = txnsRes.data ?? [];

  const income = txns
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + Number(t.amount_myr ?? 0), 0);
  const expense = txns
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + Number(t.amount_myr ?? 0), 0);
  const paidInvoices = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.total_myr ?? 0), 0);

  const summaryCsv = toCsv(
    [
      {
        month,
        income_myr: income.toFixed(2),
        expense_myr: expense.toFixed(2),
        net_myr: (income - expense).toFixed(2),
        invoices_paid_myr: paidInvoices.toFixed(2),
        invoice_count: String(invoices.length),
        transaction_count: String(txns.length),
      },
    ],
    [
      "month",
      "income_myr",
      "expense_myr",
      "net_myr",
      "invoices_paid_myr",
      "invoice_count",
      "transaction_count",
    ],
  );

  const invoicesCsv = toCsv(
    invoices.map((i) => ({
      number: i.number ?? "",
      invoice_date: i.invoice_date ?? "",
      customer_name: i.customer_name ?? "",
      status: i.status ?? "",
      amount_myr: String(i.amount_myr ?? 0),
      tax_myr: String(i.tax_myr ?? 0),
      total_myr: String(i.total_myr ?? 0),
      paid_at: i.paid_at ?? "",
    })),
    [
      "number",
      "invoice_date",
      "customer_name",
      "status",
      "amount_myr",
      "tax_myr",
      "total_myr",
      "paid_at",
    ],
  );

  const txnsCsv = toCsv(
    txns.map((t) => ({
      txn_date: t.txn_date ?? "",
      kind: t.kind ?? "",
      category: t.category ?? "",
      description: t.description ?? "",
      counterparty: t.counterparty ?? "",
      amount_myr: String(t.amount_myr ?? 0),
      payment_method: t.payment_method ?? "",
    })),
    [
      "txn_date",
      "kind",
      "category",
      "description",
      "counterparty",
      "amount_myr",
      "payment_method",
    ],
  );

  return [
    "# SUMMARY",
    summaryCsv,
    "",
    "# INVOICES",
    invoicesCsv,
    "",
    "# TRANSACTIONS",
    txnsCsv,
  ].join("\n");
}
