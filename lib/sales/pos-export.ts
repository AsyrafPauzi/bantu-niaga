import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { toCsv } from "@/lib/marketing/csv";
import { malaysiaDayBounds, malaysiaTodayYmd } from "@/lib/sales/schemas";

export type SalesExportPeriod = "today" | "week" | "month";

function periodBounds(period: SalesExportPeriod): {
  startIso: string;
  endIso: string;
  label: string;
} {
  const today = malaysiaTodayYmd();
  if (period === "today") {
    const { dayStartIso, dayEndIso } = malaysiaDayBounds(today);
    return { startIso: dayStartIso, endIso: dayEndIso, label: today };
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
      label: `${startYmd}_to_${today}`,
    };
  }

  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return {
    startIso: `${monthStart}T00:00:00.000+08:00`,
    endIso: `${monthEnd}T23:59:59.999+08:00`,
    label: `${y}-${String(m).padStart(2, "0")}`,
  };
}

function payLabel(method: string): string {
  if (method === "cash") return "cash";
  if (method === "duitnow_qr_static") return "duitnow_qr";
  return method;
}

export async function buildPosSalesExportCsv(
  supabase: SupabaseClient,
  businessId: string,
  period: SalesExportPeriod,
): Promise<string> {
  const { startIso, endIso, label } = periodBounds(period);

  const { data, error } = await supabase
    .from("pos_sales")
    .select(
      "sale_number, created_at, customer_name, payment_method, subtotal_myr, discount_amount_myr, sst_amount_myr, total_myr",
    )
    .eq("business_id", businessId)
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) => ({
    sale_number: row.sale_number ?? "",
    created_at: row.created_at ?? "",
    customer_name: row.customer_name ?? "",
    payment_method: payLabel(row.payment_method ?? ""),
    subtotal_myr: Number(row.subtotal_myr ?? 0).toFixed(2),
    discount_myr: Number(row.discount_amount_myr ?? 0).toFixed(2),
    sst_myr: Number(row.sst_amount_myr ?? 0).toFixed(2),
    total_myr: Number(row.total_myr ?? 0).toFixed(2),
  }));

  const total = rows.reduce((sum, r) => sum + Number(r.total_myr), 0);
  const columns = [
    "sale_number",
    "created_at",
    "customer_name",
    "payment_method",
    "subtotal_myr",
    "discount_myr",
    "sst_myr",
    "total_myr",
  ] as const;

  return [
    `# POS SALES — ${period.toUpperCase()} (${label})`,
    `# Total: RM ${total.toFixed(2)} | Receipts: ${rows.length}`,
    "",
    toCsv(rows, [...columns]),
  ].join("\n");
}

export function parseSalesExportPeriod(raw?: string | null): SalesExportPeriod {
  if (raw === "week" || raw === "month") return raw;
  return "today";
}
