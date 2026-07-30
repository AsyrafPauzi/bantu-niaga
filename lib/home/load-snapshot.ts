import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeFinanceMonthSummary } from "@/lib/finance/helpers";
import { computeOperationsSummary } from "@/lib/operations/helpers";
import { malaysiaDayBounds, malaysiaTodayYmd } from "@/lib/sales/schemas";

const MS_PER_DAY = 86_400_000;

export interface CashflowDay {
  day: string;
  inflow: number;
  outflow: number;
}

export interface HomeSnapshot {
  revenueMtd: number;
  revenueGrowthPct: number | null;
  outstanding: number;
  outstandingInvoices: number;
  lowStock: number;
  cashflow: CashflowDay[];
  financeMtd: number;
  opsBacklog: number;
  opsAtRisk: number;
  salesTickets: number;
  salesToday: number;
  hrHeadcount: number;
  hrPendingLeave: number;
  docsThisMonth: number;
}

export interface HomeActivityRow {
  id: string;
  kind: "invoice_paid" | "pos_sale" | "low_stock" | "customer";
  title: string;
  subtitle: string;
  amount: string;
  createdAt: string;
}

function prevMonthKey(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthStartMyt(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}-01`;
}

function last7DaysMyt(): { iso: string; label: string }[] {
  const now = new Date();
  const out: { iso: string; label: string }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * MS_PER_DAY);
    out.push({
      iso: d.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" }),
      label: d.toLocaleDateString("en-MY", {
        weekday: "short",
        timeZone: "Asia/Kuala_Lumpur",
      }),
    });
  }
  return out;
}

function formatMyrCompact(amount: number): string {
  return `RM ${Math.round(amount).toLocaleString("en-MY")}`;
}

async function loadCashflowSeries(
  supabase: SupabaseClient,
  businessId: string,
): Promise<CashflowDay[]> {
  const days = last7DaysMyt();
  const start = days[0]?.iso;
  if (!start) return [];

  const { data } = await supabase
    .from("finance_transactions")
    .select("kind, amount_myr, txn_date")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .gte("txn_date", start);

  const buckets = new Map<string, { inflow: number; outflow: number }>();
  for (const d of days) {
    buckets.set(d.iso, { inflow: 0, outflow: 0 });
  }

  for (const row of data ?? []) {
    const date = String(row.txn_date).slice(0, 10);
    const bucket = buckets.get(date);
    if (!bucket) continue;
    const amt = Number(row.amount_myr);
    if (row.kind === "income") bucket.inflow += amt;
    else bucket.outflow += amt;
  }

  return days.map((d) => {
    const bucket = buckets.get(d.iso) ?? { inflow: 0, outflow: 0 };
    return { day: d.label, inflow: bucket.inflow, outflow: bucket.outflow };
  });
}

function summarizeCustomerEvent(
  name: string,
  payload: Record<string, unknown>,
): string {
  const customerName =
    typeof payload.customer_name === "string" ? payload.customer_name : null;
  const ref = customerName ? ` for ${customerName}` : "";

  switch (name) {
    case "customer.created":
      return customerName
        ? `Created customer ${customerName}`
        : "Created a customer";
    case "customer.tag_changed":
      return `Tag changed${ref}`;
    case "customer.merged":
      return `Merged customers${ref}`;
    default:
      return name;
  }
}

export async function loadHomeSnapshot(
  supabase: SupabaseClient,
  businessId: string,
): Promise<HomeSnapshot> {
  const prevMonth = prevMonthKey();
  const monthStart = monthStartMyt();
  const today = malaysiaTodayYmd();
  const { dayStartIso, dayEndIso } = malaysiaDayBounds(today);

  const [
    financeNow,
    financePrev,
    ops,
    cashflow,
    openInvoicesRes,
    salesTodayRes,
    hrEmployeesRes,
    hrLeaveRes,
    adminFilesRes,
  ] = await Promise.all([
    computeFinanceMonthSummary(supabase, businessId),
    computeFinanceMonthSummary(supabase, businessId, prevMonth),
    computeOperationsSummary(supabase, businessId),
    loadCashflowSeries(supabase, businessId),
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "sent")
      .is("deleted_at", null),
    supabase
      .from("pos_sales")
      .select("id, total_myr")
      .eq("business_id", businessId)
      .gte("created_at", dayStartIso)
      .lt("created_at", dayEndIso),
    supabase
      .from("hr_employees")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "active"),
    supabase
      .from("hr_leave_records")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "pending"),
    supabase
      .from("admin_files")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .gte("created_at", `${monthStart}T00:00:00+08:00`),
  ]);

  const revenueMtd = financeNow.income_myr;
  const prevRevenue = financePrev.income_myr;
  const revenueGrowthPct =
    prevRevenue > 0
      ? Math.round(((revenueMtd - prevRevenue) / prevRevenue) * 1000) / 10
      : null;

  const todaySales = salesTodayRes.data ?? [];
  const salesToday = todaySales.reduce(
    (sum, row) => sum + Number(row.total_myr ?? 0),
    0,
  );

  return {
    revenueMtd,
    revenueGrowthPct,
    outstanding: financeNow.invoice_outstanding_myr,
    outstandingInvoices: openInvoicesRes.count ?? 0,
    lowStock: ops.low_stock_count,
    cashflow,
    financeMtd: financeNow.income_myr,
    opsBacklog: ops.open_orders,
    opsAtRisk: ops.overdue_count,
    salesTickets: todaySales.length,
    salesToday,
    hrHeadcount: hrEmployeesRes.count ?? 0,
    hrPendingLeave: hrLeaveRes.count ?? 0,
    docsThisMonth: adminFilesRes.count ?? 0,
  };
}

export async function loadHomeRecentActivity(
  supabase: SupabaseClient,
  businessId: string,
  limit = 6,
): Promise<HomeActivityRow[]> {
  const fetchLimit = Math.max(limit, 6);

  const [invoicesRes, posRes, stockRes, eventsRes] = await Promise.all([
    supabase
      .from("finance_invoices")
      .select("id, number, total_myr, paid_at, customer_name")
      .eq("business_id", businessId)
      .eq("status", "paid")
      .is("deleted_at", null)
      .not("paid_at", "is", null)
      .order("paid_at", { ascending: false })
      .limit(fetchLimit),
    supabase
      .from("pos_sales")
      .select("id, sale_number, total_myr, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(fetchLimit),
    supabase
      .from("operations_products")
      .select("id, name, stock_qty, low_stock_threshold, updated_at")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .not("stock_qty", "is", null)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("events_outbox")
      .select("id, name, payload, emitted_at")
      .in("name", [
        "customer.created",
        "customer.tag_changed",
        "customer.merged",
        "invoice.paid",
        "stock.low",
      ])
      .order("emitted_at", { ascending: false })
      .limit(fetchLimit),
  ]);

  const rows: HomeActivityRow[] = [];

  for (const inv of invoicesRes.data ?? []) {
    rows.push({
      id: `inv-${inv.id}`,
      kind: "invoice_paid",
      title: `${inv.number} paid`,
      subtitle: inv.customer_name ? String(inv.customer_name) : "Invoice payment",
      amount: formatMyrCompact(Number(inv.total_myr)),
      createdAt: String(inv.paid_at),
    });
  }

  for (const sale of posRes.data ?? []) {
    rows.push({
      id: `pos-${sale.id}`,
      kind: "pos_sale",
      title: `POS sale${sale.sale_number ? ` — ${sale.sale_number}` : ""}`,
      subtitle: "Point of sale",
      amount: formatMyrCompact(Number(sale.total_myr)),
      createdAt: String(sale.created_at),
    });
  }

  for (const product of stockRes.data ?? []) {
    const qty = Number(product.stock_qty);
    const threshold = Number(product.low_stock_threshold ?? 5);
    if (qty > threshold) continue;
    rows.push({
      id: `stock-${product.id}`,
      kind: "low_stock",
      title: `Low stock — ${product.name}`,
      subtitle: `${qty} left (reorder at ${threshold})`,
      amount: "Reorder",
      createdAt: String(product.updated_at ?? new Date().toISOString()),
    });
  }

  for (const event of eventsRes.data ?? []) {
    const payload =
      event.payload && typeof event.payload === "object"
        ? (event.payload as Record<string, unknown>)
        : {};
    const name = String(event.name);
    rows.push({
      id: `evt-${event.id}`,
      kind: name.startsWith("customer.") ? "customer" : name === "stock.low" ? "low_stock" : "invoice_paid",
      title:
        name === "invoice.paid" && typeof payload.invoice_number === "string"
          ? `${payload.invoice_number} paid`
          : name === "stock.low" && typeof payload.product_name === "string"
            ? `Low stock — ${payload.product_name}`
            : summarizeCustomerEvent(name, payload),
      subtitle: "Live event",
      amount: name === "invoice.paid" ? "Paid" : "Live",
      createdAt: String(event.emitted_at),
    });
  }

  rows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const seen = new Set<string>();
  const deduped: HomeActivityRow[] = [];
  for (const row of rows) {
    const key = `${row.kind}:${row.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= limit) break;
  }

  return deduped;
}
