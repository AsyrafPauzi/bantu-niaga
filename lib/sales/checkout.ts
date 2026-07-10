import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { malaysiaTodayYmd } from "@/lib/sales/schemas";

export async function nextSaleNumber(
  supabase: SupabaseClient,
  businessId: string,
): Promise<string> {
  const day = malaysiaTodayYmd().replace(/-/g, "");
  const prefix = `POS-${day}-`;
  const { data } = await supabase
    .from("pos_sales")
    .select("sale_number")
    .eq("business_id", businessId)
    .like("sale_number", `${prefix}%`)
    .order("sale_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  let seq = 1;
  if (data?.sale_number) {
    const tail = String(data.sale_number).slice(prefix.length);
    const n = Number.parseInt(tail, 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function postPosSaleToFinance(opts: {
  supabase: SupabaseClient;
  businessId: string;
  userId: string;
  saleId: string;
  saleNumber: string;
  totalMyr: number;
  paymentMethod: "cash" | "duitnow_qr_static";
  customerName: string | null;
}): Promise<string | null> {
  const payment_method =
    opts.paymentMethod === "cash" ? "cash" : "duitnow";

  const { data, error } = await opts.supabase
    .from("finance_transactions")
    .insert({
      business_id: opts.businessId,
      kind: "income",
      amount_myr: opts.totalMyr,
      category: "sales",
      description: `POS ${opts.saleNumber}`,
      counterparty: opts.customerName ?? "Walk-in",
      payment_method,
      txn_date: malaysiaTodayYmd(),
      created_by: opts.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to post POS sale to Finance");
  }

  await opts.supabase
    .from("pos_sales")
    .update({ finance_transaction_id: data.id })
    .eq("id", opts.saleId)
    .eq("business_id", opts.businessId);

  return data.id as string;
}
