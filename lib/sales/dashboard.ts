import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { malaysiaDayBounds, malaysiaTodayYmd } from "@/lib/sales/schemas";

export type SalesRecentRow = {
  id: string;
  sale_number: string;
  total_myr: number;
  payment_method: string;
  customer_name: string | null;
  created_at: string;
};

export type SalesTopProduct = {
  product_name: string;
  quantity: number;
  revenue_myr: number;
};

export type SalesCashierRow = {
  cashier_user_id: string;
  display_name: string;
  txn_count: number;
  total_myr: number;
};

export interface SalesDashboardData {
  todayYmd: string;
  summary: {
    salesTodayMyr: number;
    txnToday: number;
    avgTicketMyr: number;
    cashTodayMyr: number;
    duitnowTodayMyr: number;
    cashPct: number;
    duitnowPct: number;
  };
  week: {
    salesMyr: number;
    txnCount: number;
    priorSalesMyr: number;
    priorTxnCount: number;
  };
  leads: {
    open: number;
    overdue: number;
    dueToday: number;
  };
  recentSales: SalesRecentRow[];
  topProducts: SalesTopProduct[];
  cashiers: SalesCashierRow[];
}

export async function loadSalesDashboard(
  supabase: SupabaseClient,
  businessId: string,
): Promise<SalesDashboardData> {
  const todayYmd = malaysiaTodayYmd();
  const { dayStartIso, dayEndIso } = malaysiaDayBounds(todayYmd);
  const dayStart = `${todayYmd}T00:00:00.000+08:00`;
  const endDate = new Date(`${todayYmd}T00:00:00.000+08:00`);
  endDate.setDate(endDate.getDate() + 1);
  const dayEnd = endDate.toISOString();

  const weekStartDate = new Date(`${todayYmd}T00:00:00.000+08:00`);
  weekStartDate.setDate(weekStartDate.getDate() - 6);
  const weekStart = weekStartDate.toISOString().slice(0, 10);
  const weekStartIso = `${weekStart}T00:00:00.000+08:00`;

  const priorWeekEndDate = new Date(weekStartDate);
  priorWeekEndDate.setDate(priorWeekEndDate.getDate() - 1);
  const priorWeekStartDate = new Date(priorWeekEndDate);
  priorWeekStartDate.setDate(priorWeekStartDate.getDate() - 6);
  const priorWeekStartIso = `${priorWeekStartDate.toISOString().slice(0, 10)}T00:00:00.000+08:00`;
  const priorWeekEndIso = `${priorWeekEndDate.toISOString().slice(0, 10)}T23:59:59.999+08:00`;

  const [
    recentRes,
    todayRes,
    weekRes,
    priorWeekRes,
    topItemsRes,
    todaySalesDetailRes,
    openLeadsRes,
    overdueLeadsRes,
    dueTodayLeadsRes,
  ] = await Promise.all([
      supabase
        .from("pos_sales")
        .select(
          "id, sale_number, total_myr, payment_method, customer_name, created_at",
        )
        .eq("business_id", businessId)
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("pos_sales")
        .select("id, total_myr, payment_method")
        .eq("business_id", businessId)
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd),
      supabase
        .from("pos_sales")
        .select("id, total_myr")
        .eq("business_id", businessId)
        .eq("status", "completed")
        .gte("created_at", weekStartIso)
        .lte("created_at", dayEndIso),
      supabase
        .from("pos_sales")
        .select("id, total_myr")
        .eq("business_id", businessId)
        .eq("status", "completed")
        .gte("created_at", priorWeekStartIso)
        .lte("created_at", priorWeekEndIso),
      supabase
        .from("pos_sale_items")
        .select("product_name, quantity, line_total_myr, sale_id")
        .eq("business_id", businessId)
        .limit(500),
      supabase
        .from("pos_sales")
        .select("id, total_myr, cashier_user_id")
        .eq("business_id", businessId)
        .eq("status", "completed")
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd),
      supabase
        .from("sales_leads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .not("status", "in", "(won,lost)"),
      supabase
        .from("sales_leads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .not("follow_up_at", "is", null)
        .lt("follow_up_at", dayStartIso)
        .not("status", "in", "(won,lost)"),
      supabase
        .from("sales_leads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("follow_up_at", dayStartIso)
        .lt("follow_up_at", dayEndIso)
        .not("status", "in", "(won,lost)"),
    ]);

  if (recentRes.error) throw new Error(recentRes.error.message);
  if (todayRes.error) throw new Error(todayRes.error.message);

  const todayRows = todayRes.data ?? [];
  const salesTodayMyr = todayRows.reduce(
    (sum, row) => sum + Number(row.total_myr ?? 0),
    0,
  );
  const txnToday = todayRows.length;
  const cashTodayMyr = todayRows
    .filter((row) => row.payment_method === "cash")
    .reduce((sum, row) => sum + Number(row.total_myr ?? 0), 0);
  const duitnowTodayMyr = todayRows
    .filter((row) => row.payment_method === "duitnow_qr_static")
    .reduce((sum, row) => sum + Number(row.total_myr ?? 0), 0);

  const weekRows = weekRes.data ?? [];
  const priorWeekRows = priorWeekRes.data ?? [];
  const weekSalesMyr = weekRows.reduce(
    (sum, row) => sum + Number(row.total_myr ?? 0),
    0,
  );
  const priorWeekSalesMyr = priorWeekRows.reduce(
    (sum, row) => sum + Number(row.total_myr ?? 0),
    0,
  );

  const todaySaleIds = new Set(
    (todaySalesDetailRes.data ?? []).map((s) => s.id as string),
  );
  const productAgg = new Map<string, { quantity: number; revenue_myr: number }>();
  for (const item of topItemsRes.data ?? []) {
    if (!todaySaleIds.has(item.sale_id as string)) continue;
    const name = String(item.product_name);
    const prev = productAgg.get(name) ?? { quantity: 0, revenue_myr: 0 };
    productAgg.set(name, {
      quantity: prev.quantity + Number(item.quantity ?? 0),
      revenue_myr: prev.revenue_myr + Number(item.line_total_myr ?? 0),
    });
  }
  const topProducts = [...productAgg.entries()]
    .map(([product_name, stats]) => ({
      product_name,
      quantity: stats.quantity,
      revenue_myr: stats.revenue_myr,
    }))
    .sort((a, b) => b.revenue_myr - a.revenue_myr)
    .slice(0, 5);

  const cashierAgg = new Map<string, { txn_count: number; total_myr: number }>();
  for (const sale of todaySalesDetailRes.data ?? []) {
    const id = sale.cashier_user_id as string;
    const prev = cashierAgg.get(id) ?? { txn_count: 0, total_myr: 0 };
    cashierAgg.set(id, {
      txn_count: prev.txn_count + 1,
      total_myr: prev.total_myr + Number(sale.total_myr ?? 0),
    });
  }

  const cashierIds = [...cashierAgg.keys()];
  let cashierNames = new Map<string, string>();
  if (cashierIds.length > 0) {
    const { data: members } = await supabase
      .from("user_business_memberships")
      .select("user_id, display_name, role")
      .eq("business_id", businessId)
      .in("user_id", cashierIds);
    cashierNames = new Map(
      (members ?? []).map((m) => [
        m.user_id as string,
        (m.display_name as string | null) || (m.role as string),
      ]),
    );
  }

  const cashiers = cashierIds
    .map((id) => {
      const stats = cashierAgg.get(id)!;
      return {
        cashier_user_id: id,
        display_name: cashierNames.get(id) ?? "Staff",
        txn_count: stats.txn_count,
        total_myr: stats.total_myr,
      };
    })
    .sort((a, b) => b.total_myr - a.total_myr);

  return {
    todayYmd,
    summary: {
      salesTodayMyr,
      txnToday,
      avgTicketMyr: txnToday > 0 ? salesTodayMyr / txnToday : 0,
      cashTodayMyr,
      duitnowTodayMyr,
      cashPct:
        salesTodayMyr > 0
          ? Math.round((cashTodayMyr / salesTodayMyr) * 100)
          : 0,
      duitnowPct:
        salesTodayMyr > 0
          ? Math.round((duitnowTodayMyr / salesTodayMyr) * 100)
          : 0,
    },
    week: {
      salesMyr: weekSalesMyr,
      txnCount: weekRows.length,
      priorSalesMyr: priorWeekSalesMyr,
      priorTxnCount: priorWeekRows.length,
    },
    leads: {
      open: openLeadsRes.count ?? 0,
      overdue: overdueLeadsRes.count ?? 0,
      dueToday: dueTodayLeadsRes.count ?? 0,
    },
    recentSales: (recentRes.data ?? []).map((row) => ({
      id: row.id,
      sale_number: row.sale_number,
      total_myr: Number(row.total_myr ?? 0),
      payment_method: row.payment_method,
      customer_name: row.customer_name,
      created_at: row.created_at,
    })),
    topProducts,
    cashiers,
  };
}
