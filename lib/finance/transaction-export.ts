import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAdminFileNames } from "@/lib/admin/validate-admin-file";
import { financeMonthBounds } from "@/lib/finance/helpers";
import { toCsv } from "@/lib/marketing/csv";
import type { FinanceTxnKind } from "@/lib/finance/schemas";

type TxnExportRow = {
  txn_date: string | null;
  kind: string | null;
  category: string | null;
  description: string | null;
  counterparty: string | null;
  amount_myr: number | null;
  payment_method: string | null;
  finance_invoice_id: string | null;
  admin_file_id: string | null;
};

function txnSource(row: TxnExportRow): string {
  if (row.finance_invoice_id) return "invoice";
  if ((row.description ?? "").startsWith("POS ")) return "pos";
  return "manual";
}

export function mapFinanceTxnExportRows(
  rows: TxnExportRow[],
  fileNames: Map<string, string>,
): Array<Record<string, string>> {
  return rows.map((row) => ({
    txn_date: row.txn_date ?? "",
    category: row.category ?? "",
    description: row.description ?? "",
    counterparty: row.counterparty ?? "",
    amount_myr: Number(row.amount_myr ?? 0).toFixed(2),
    payment_method: row.payment_method ?? "",
    receipt: row.admin_file_id
      ? (fileNames.get(row.admin_file_id) ?? "attached")
      : "",
    source: txnSource(row),
  }));
}

const EXPORT_COLUMNS = [
  "txn_date",
  "category",
  "description",
  "counterparty",
  "amount_myr",
  "payment_method",
  "receipt",
  "source",
] as const;

export async function buildFinanceTransactionExportCsv(
  supabase: SupabaseClient,
  businessId: string,
  month: string,
  kind: FinanceTxnKind,
): Promise<string> {
  const { start, end } = financeMonthBounds(month);

  const { data, error } = await supabase
    .from("finance_transactions")
    .select(
      "txn_date, kind, category, description, counterparty, amount_myr, payment_method, finance_invoice_id, admin_file_id",
    )
    .eq("business_id", businessId)
    .eq("kind", kind)
    .is("deleted_at", null)
    .gte("txn_date", start)
    .lte("txn_date", end)
    .order("txn_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as TxnExportRow[];
  const fileNames = await loadAdminFileNames(
    supabase,
    businessId,
    rows.map((r) => r.admin_file_id).filter(Boolean) as string[],
  );

  const mapped = mapFinanceTxnExportRows(rows, fileNames);
  const total = rows.reduce((sum, row) => sum + Number(row.amount_myr ?? 0), 0);
  const heading = kind === "expense" ? "EXPENSES" : "INCOME";

  return [
    `# ${heading} — ${month}`,
    `# Total: RM ${total.toFixed(2)} | Entries: ${rows.length}`,
    "",
    toCsv(mapped, [...EXPORT_COLUMNS]),
  ].join("\n");
}
