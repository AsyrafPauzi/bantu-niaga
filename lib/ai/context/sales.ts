import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentContext,
  PillarSnapshot,
  SnapshotAttention,
  SnapshotItem,
  SnapshotKpi,
} from "./types";
import { createAgentScopedClient } from "./client";
import { malaysiaDayBounds, malaysiaTodayYmd } from "@/lib/sales/schemas";

/**
 * Sales snapshot for Sufi / Boardroom — leads + today's POS.
 */
export async function buildSalesSnapshot(
  ctx: AgentContext,
  client?: SupabaseClient,
): Promise<PillarSnapshot> {
  const supabase = client ?? (await createAgentScopedClient(ctx));
  const today = malaysiaTodayYmd();
  const { dayStartIso, dayEndIso } = malaysiaDayBounds(today);

  const [leadsRes, todaySalesRes, overdueRes, dueTodayRes, productsRes] =
    await Promise.all([
      supabase
        .from("sales_leads")
        .select("id, name, status, follow_up_at, assigned_to, estimated_value_myr")
        .eq("business_id", ctx.businessId)
        .order("updated_at", { ascending: false })
        .limit(40),
      supabase
        .from("pos_sales")
        .select("id, total_myr, payment_method, sale_number, created_at")
        .eq("business_id", ctx.businessId)
        .gte("created_at", dayStartIso)
        .lt("created_at", dayEndIso),
      supabase
        .from("sales_leads")
        .select("id, name, phone_e164, follow_up_at, status")
        .eq("business_id", ctx.businessId)
        .not("follow_up_at", "is", null)
        .lt("follow_up_at", dayStartIso)
        .not("status", "in", "(won,lost)")
        .order("follow_up_at", { ascending: true })
        .limit(8),
      supabase
        .from("sales_leads")
        .select("id, name, phone_e164, follow_up_at, status")
        .eq("business_id", ctx.businessId)
        .gte("follow_up_at", dayStartIso)
        .lt("follow_up_at", dayEndIso)
        .not("status", "in", "(won,lost)")
        .order("follow_up_at", { ascending: true })
        .limit(8),
      supabase
        .from("operations_products")
        .select("id, name")
        .eq("business_id", ctx.businessId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .limit(12),
    ]);

  const leads = leadsRes.data ?? [];
  const todaySales = todaySalesRes.data ?? [];
  const overdue = overdueRes.data ?? [];
  const dueToday = dueTodayRes.data ?? [];
  const products = productsRes.data ?? [];

  const byStatus: Record<string, number> = {};
  for (const l of leads) {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
  }

  const salesToday = todaySales.reduce(
    (a, r) => a + Number(r.total_myr ?? 0),
    0,
  );
  const cashToday = todaySales
    .filter((r) => r.payment_method === "cash")
    .reduce((a, r) => a + Number(r.total_myr ?? 0), 0);
  const duitnowToday = todaySales
    .filter((r) => r.payment_method === "duitnow_qr_static")
    .reduce((a, r) => a + Number(r.total_myr ?? 0), 0);

  const available = leads.length > 0 || todaySales.length > 0;

  const attention: SnapshotAttention[] = [];
  if (overdue.length > 0) {
    attention.push({
      id: "overdue_leads",
      label: `${overdue.length} overdue lead follow-up(s)`,
      severity: "high",
    });
  }
  if (dueToday.length > 0) {
    attention.push({
      id: "due_today_leads",
      label: `${dueToday.length} lead(s) due today`,
      severity: "medium",
    });
  }
  if (todaySales.length === 0) {
    attention.push({
      id: "no_pos_today",
      label: "No POS sales recorded today yet",
      severity: "low",
    });
  }

  const recent: SnapshotItem[] = [
    ...overdue.slice(0, 3).map((l) => ({
      id: l.id,
      label: `Overdue: ${l.name}`,
      meta: l.phone_e164,
      at: l.follow_up_at,
    })),
    ...dueToday.slice(0, 3).map((l) => ({
      id: l.id,
      label: `Due today: ${l.name}`,
      meta: l.phone_e164,
      at: l.follow_up_at,
    })),
    ...todaySales.slice(0, 3).map((s) => ({
      id: s.id,
      label: s.sale_number,
      meta: `RM ${Number(s.total_myr).toFixed(2)} · ${s.payment_method}`,
      at: s.created_at,
    })),
  ].slice(0, 10);

  const kpis: SnapshotKpi[] = [
    { key: "sales_today", label: "Sales today", value: Number(salesToday.toFixed(2)), unit: "MYR" },
    { key: "txns_today", label: "Txns today", value: todaySales.length },
    { key: "overdue_leads", label: "Overdue leads", value: overdue.length },
    { key: "due_today", label: "Due today", value: dueToday.length },
    { key: "new_leads", label: "Open new leads", value: byStatus.new ?? 0 },
    { key: "cash_today", label: "Cash today", value: Number(cashToday.toFixed(2)), unit: "MYR" },
    { key: "duitnow_today", label: "DuitNow today", value: Number(duitnowToday.toFixed(2)), unit: "MYR" },
  ];

  const productNames = products
    .slice(0, 6)
    .map((p) => p.name)
    .join(", ");
  const notes = available
    ? `Today ${today}. Lead statuses: ${JSON.stringify(byStatus)}. Catalog sample (${products.length}): ${productNames || "none"}.`
    : `Today ${today}. Thin data — add leads and ring POS so Sufi can coach better.`;

  return {
    pillar: "sales",
    businessId: ctx.businessId,
    generatedAt: new Date().toISOString(),
    available,
    headline: available
      ? `Sales today RM ${salesToday.toFixed(2)} · ${overdue.length} overdue · ${dueToday.length} due today`
      : "No sales leads or POS sales yet — start with a lead or open POS.",
    kpis,
    recent,
    attention,
    notes: notes.slice(0, 300),
  };
}
