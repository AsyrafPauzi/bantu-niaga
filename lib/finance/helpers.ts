import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinanceMonthSummary } from "@/lib/finance/schemas";

export function generateShareHash(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export async function nextFinanceInvoiceNumber(
  admin: SupabaseClient,
  businessId: string,
  prefix = "INV",
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;
  const { data } = await admin
    .from("finance_invoices")
    .select("number")
    .eq("business_id", businessId)
    .like("number", `${pattern}%`)
    .order("number", { ascending: false })
    .limit(1);

  const last = (data?.[0] as { number: string } | undefined)?.number;
  let seq = 1;
  if (last?.startsWith(pattern)) {
    const tail = parseInt(last.slice(pattern.length), 10);
    if (Number.isFinite(tail)) seq = tail + 1;
  }
  return `${pattern}${String(seq).padStart(4, "0")}`;
}

function monthBounds(month?: string): { start: string; end: string; label: string } {
  const now = new Date();
  const [y, m] = month
    ? month.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const endDate = new Date(y, m, 0);
  const end = `${y}-${String(m).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  return { start, end, label: `${y}-${String(m).padStart(2, "0")}` };
}

export async function computeFinanceMonthSummary(
  admin: SupabaseClient,
  businessId: string,
  month?: string,
): Promise<FinanceMonthSummary> {
  const { start, end, label } = monthBounds(month);

  const { data: txns } = await admin
    .from("finance_transactions")
    .select("kind, amount_myr")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .gte("txn_date", start)
    .lte("txn_date", end);

  let income_myr = 0;
  let expense_myr = 0;
  for (const row of (txns ?? []) as Array<{ kind: string; amount_myr: number }>) {
    const amt = Number(row.amount_myr);
    if (row.kind === "income") income_myr += amt;
    else expense_myr += amt;
  }

  const { data: invoices } = await admin
    .from("finance_invoices")
    .select("status, total_myr")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .in("status", ["sent", "paid"]);

  let invoice_paid_myr = 0;
  let invoice_outstanding_myr = 0;
  for (const inv of (invoices ?? []) as Array<{
    status: string;
    total_myr: number;
  }>) {
    const amt = Number(inv.total_myr);
    if (inv.status === "paid") invoice_paid_myr += amt;
    if (inv.status === "sent") invoice_outstanding_myr += amt;
  }

  return {
    month: label,
    income_myr,
    expense_myr,
    net_myr: income_myr - expense_myr,
    invoice_paid_myr,
    invoice_outstanding_myr,
  };
}
