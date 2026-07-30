import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAgentScopedClient, verifyRows } from "./client";
import type {
  AgentContext,
  PillarSnapshot,
  SnapshotAttention,
  SnapshotItem,
} from "./types";

/**
 * Finance overview snapshot.
 *
 * Aggregates from `finance_invoices` + `finance_transactions` (RLS-scoped to the
 * caller's tenant). Returns invoice status counts, MTD cash flow, and recent
 * records in <2 KB of JSON.
 */
export async function buildFinanceSnapshot(
  ctx: AgentContext,
  client?: SupabaseClient,
): Promise<PillarSnapshot> {
  const supabase = client ?? (await createAgentScopedClient(ctx));

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const monthStart = startOfMonth.toISOString().slice(0, 10);

  const [invoicesRes, txnsRes] = await Promise.all([
    supabase
      .from("finance_invoices")
      .select(
        "id, business_id, number, customer_name, total_myr, status, due_date, paid_at, created_at",
      )
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("finance_transactions")
      .select("id, business_id, kind, amount_myr, description, txn_date, created_at")
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .gte("txn_date", monthStart)
      .order("txn_date", { ascending: false })
      .limit(30),
  ]);

  const invoices = verifyRows(invoicesRes, ctx, "finance_invoices");
  const txns = verifyRows(txnsRes, ctx, "finance_transactions");

  const paid = invoices.filter((i) => i.status === "paid");
  const sent = invoices.filter((i) => i.status === "sent");
  const draft = invoices.filter((i) => i.status === "draft");
  const voided = invoices.filter((i) => i.status === "void");

  const today = new Date().toISOString().slice(0, 10);
  const overdueSent = sent.filter(
    (i) => i.due_date && String(i.due_date) < today,
  );

  const mtdIncome = txns
    .filter((t) => t.kind === "income")
    .reduce((acc, t) => acc + Number(t.amount_myr ?? 0), 0);
  const mtdExpense = txns
    .filter((t) => t.kind === "expense")
    .reduce((acc, t) => acc + Number(t.amount_myr ?? 0), 0);

  const sentOutstanding = sent.reduce(
    (acc, i) => acc + Number(i.total_myr ?? 0),
    0,
  );

  const mtdPaidInvoices = paid
    .filter(
      (i) =>
        i.paid_at &&
        new Date(i.paid_at as string).getTime() >= startOfMonth.getTime(),
    )
    .reduce((acc, i) => acc + Number(i.total_myr ?? 0), 0);

  const recent: SnapshotItem[] = [
    ...invoices.slice(0, 5).map((i) => ({
      id: i.id as string,
      label: `${String(i.number)} · ${String(i.status)}`,
      meta: `${i.customer_name ?? "—"} · RM ${Number(i.total_myr ?? 0).toFixed(2)}`,
      at: (i.paid_at as string | null) ?? (i.created_at as string),
    })),
    ...txns.slice(0, 3).map((t) => ({
      id: t.id as string,
      label: `${String(t.kind)} · ${String(t.description ?? "—")}`,
      meta: `RM ${Number(t.amount_myr ?? 0).toFixed(2)}`,
      at: (t.txn_date as string) ?? (t.created_at as string),
    })),
  ].slice(0, 8);

  const attention: SnapshotAttention[] = [];
  if (overdueSent.length > 0) {
    attention.push({
      id: "overdue_invoices",
      label: `${overdueSent.length} sent invoice(s) past due (RM ${overdueSent.reduce((a, i) => a + Number(i.total_myr ?? 0), 0).toFixed(2)})`,
      severity: "high",
    });
  }
  if (sent.length >= 3) {
    attention.push({
      id: "sent_pileup",
      label: `${sent.length} sent invoices outstanding (RM ${sentOutstanding.toFixed(2)})`,
      severity: "medium",
    });
  }
  if (mtdExpense > mtdIncome && mtdIncome > 0) {
    attention.push({
      id: "expenses_above_income",
      label: `MTD expenses (RM ${mtdExpense.toFixed(2)}) exceed income (RM ${mtdIncome.toFixed(2)})`,
      severity: "medium",
    });
  }

  const available = invoices.length > 0 || txns.length > 0;

  return {
    pillar: "finance",
    businessId: ctx.businessId,
    generatedAt: new Date().toISOString(),
    available,
    headline: available
      ? `Finance: ${paid.length} paid, ${sent.length} sent, ${draft.length} draft · MTD income RM ${mtdIncome.toFixed(2)} vs expense RM ${mtdExpense.toFixed(2)}`
      : "No finance invoices or transactions yet — add invoices or log cash flow.",
    kpis: [
      {
        key: "mtd_income",
        label: "MTD income (ledger)",
        value: Number(mtdIncome.toFixed(2)),
        unit: "MYR",
      },
      {
        key: "mtd_expense",
        label: "MTD expense (ledger)",
        value: Number(mtdExpense.toFixed(2)),
        unit: "MYR",
      },
      {
        key: "mtd_paid_invoices",
        label: "MTD paid invoices",
        value: Number(mtdPaidInvoices.toFixed(2)),
        unit: "MYR",
      },
      {
        key: "sent_outstanding",
        label: "Sent outstanding",
        value: Number(sentOutstanding.toFixed(2)),
        unit: "MYR",
      },
      {
        key: "invoices_paid",
        label: "Invoices paid (visible)",
        value: paid.length,
      },
      {
        key: "invoices_sent",
        label: "Invoices sent",
        value: sent.length,
      },
      {
        key: "invoices_overdue",
        label: "Sent overdue",
        value: overdueSent.length,
      },
      {
        key: "invoices_draft",
        label: "Invoices draft",
        value: draft.length,
      },
      {
        key: "invoices_void",
        label: "Invoices void",
        value: voided.length,
      },
    ],
    recent,
    attention,
    notes:
      overdueSent.length > 0
        ? "Chase overdue sent invoices before taking on new payables."
        : undefined,
  };
}
