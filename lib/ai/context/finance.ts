import "server-only";

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
 * Aggregates from `invoices` + `credit_ledger` (RLS-scoped to the
 * caller's tenant). Returns the most-used finance signals — paid /
 * pending / failed counts, MTD revenue, credit movement, top recent
 * invoices — in <2 KB of JSON.
 */
export async function buildFinanceSnapshot(
  ctx: AgentContext,
): Promise<PillarSnapshot> {
  const supabase = await createAgentScopedClient(ctx);

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  // Pull only the columns we need; never SELECT *.
  const invoicesRes = await supabase
    .from("invoices")
    .select(
      "id, business_id, number, kind, amount_myr, tax_myr, status, paid_at, created_at",
    )
    .eq("business_id", ctx.businessId)
    .order("created_at", { ascending: false })
    .limit(40);

  const invoices = verifyRows(invoicesRes, ctx, "invoices");

  const creditsRes = await supabase
    .from("credit_ledger")
    .select("id, business_id, delta, reason, created_at")
    .eq("business_id", ctx.businessId)
    .order("created_at", { ascending: false })
    .limit(20);

  const credits = verifyRows(creditsRes, ctx, "credit_ledger");

  const paid = invoices.filter((i) => i.status === "paid");
  const pending = invoices.filter((i) => i.status === "pending");
  const failed = invoices.filter((i) => i.status === "failed");

  const mtdRevenue = paid
    .filter(
      (i) =>
        i.paid_at &&
        new Date(i.paid_at as string).getTime() >= startOfMonth.getTime(),
    )
    .reduce((acc, i) => acc + Number(i.amount_myr ?? 0), 0);

  const pendingTotal = pending.reduce(
    (acc, i) => acc + Number(i.amount_myr ?? 0),
    0,
  );

  const creditTotal30d = credits
    .filter(
      (c) =>
        new Date(c.created_at as string).getTime() >=
        Date.now() - 30 * 24 * 60 * 60 * 1000,
    )
    .reduce((acc, c) => acc + Number(c.delta ?? 0), 0);

  const recent: SnapshotItem[] = invoices.slice(0, 8).map((i) => ({
    id: i.id as string,
    label: `${String(i.number)} · ${String(i.status)}`,
    meta: `RM ${Number(i.amount_myr ?? 0).toFixed(2)} · ${i.kind ?? "—"}`,
    at: (i.paid_at as string | null) ?? (i.created_at as string),
  }));

  const attention: SnapshotAttention[] = [];
  if (failed.length > 0) {
    attention.push({
      id: "failed_invoices",
      label: `${failed.length} failed invoice(s) — likely payment retry needed`,
      severity: "high",
    });
  }
  if (pending.length >= 5) {
    attention.push({
      id: "pending_pileup",
      label: `${pending.length} pending invoices (RM ${pendingTotal.toFixed(2)} outstanding)`,
      severity: "medium",
    });
  }

  return {
    pillar: "finance",
    businessId: ctx.businessId,
    generatedAt: new Date().toISOString(),
    available: true,
    headline: `Finance snapshot: ${invoices.length} invoices loaded, ${paid.length} paid, ${pending.length} pending.`,
    kpis: [
      {
        key: "mtd_revenue",
        label: "MTD revenue",
        value: Number(mtdRevenue.toFixed(2)),
        unit: "MYR",
      },
      {
        key: "pending_total",
        label: "Pending outstanding",
        value: Number(pendingTotal.toFixed(2)),
        unit: "MYR",
      },
      {
        key: "invoices_paid",
        label: "Invoices paid (visible)",
        value: paid.length,
      },
      {
        key: "invoices_pending",
        label: "Invoices pending",
        value: pending.length,
      },
      {
        key: "invoices_failed",
        label: "Invoices failed",
        value: failed.length,
      },
      {
        key: "credit_net_30d",
        label: "Credit net (30d)",
        value: creditTotal30d,
        unit: "credits",
      },
    ],
    recent,
    attention,
    notes:
      failed.length > 0
        ? "Investigate failed invoices before discussing new charges."
        : undefined,
  };
}
