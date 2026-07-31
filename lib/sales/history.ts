import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { malaysiaDayBounds, malaysiaTodayYmd } from "@/lib/sales/schemas";
import type { SalesExportPeriod } from "@/lib/sales/pos-export";

export type SalesHistoryRow = {
  id: string;
  sale_number: string;
  total_myr: number;
  payment_method: string;
  customer_name: string | null;
  created_at: string;
};

export interface SalesHistoryData {
  period: SalesExportPeriod;
  salesMyr: number;
  txnCount: number;
  rows: SalesHistoryRow[];
  total: number;
}

function periodBounds(period: SalesExportPeriod): {
  startIso: string;
  endIso: string;
} {
  const today = malaysiaTodayYmd();
  if (period === "today") {
    const { dayStartIso, dayEndIso } = malaysiaDayBounds(today);
    return { startIso: dayStartIso, endIso: dayEndIso };
  }

  const [y, m, d] = today.split("-").map(Number);
  const endDate = new Date(Date.UTC(y, m - 1, d, 16, 0, 0));
  if (period === "week") {
    const start = new Date(endDate);
    start.setUTCDate(start.getUTCDate() - 6);
    const startYmd = start.toISOString().slice(0, 10);
    return {
      startIso: `${startYmd}T00:00:00.000+08:00`,
      endIso: `${today}T23:59:59.999+08:00`,
    };
  }

  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return {
    startIso: `${monthStart}T00:00:00.000+08:00`,
    endIso: `${monthEnd}T23:59:59.999+08:00`,
  };
}

export function parseSalesHistoryPeriod(
  raw?: string | null,
): SalesExportPeriod {
  if (raw === "week" || raw === "month") return raw;
  return "today";
}

export async function loadSalesHistory(
  supabase: SupabaseClient,
  businessId: string,
  period: SalesExportPeriod,
  opts?: { from?: number; to?: number },
): Promise<SalesHistoryData> {
  const { startIso, endIso } = periodBounds(period);

  let query = supabase
    .from("pos_sales")
    .select(
      "id, sale_number, total_myr, payment_method, customer_name, created_at",
      { count: "exact" },
    )
    .eq("business_id", businessId)
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: false });

  if (opts?.from !== undefined && opts?.to !== undefined) {
    query = query.range(opts.from, opts.to);
  } else {
    query = query.limit(50);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const { data: sumRows, error: sumErr } = await supabase
    .from("pos_sales")
    .select("total_myr")
    .eq("business_id", businessId)
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  if (sumErr) throw new Error(sumErr.message);

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    sale_number: row.sale_number,
    total_myr: Number(row.total_myr ?? 0),
    payment_method: row.payment_method,
    customer_name: row.customer_name,
    created_at: row.created_at,
  }));

  const salesMyr = (sumRows ?? []).reduce(
    (sum, r) => sum + Number(r.total_myr ?? 0),
    0,
  );

  return {
    period,
    salesMyr,
    txnCount: count ?? rows.length,
    rows,
    total: count ?? rows.length,
  };
}
