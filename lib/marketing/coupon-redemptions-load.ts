import type { SupabaseClient } from "@supabase/supabase-js";

export type CustomerCouponRedemption = {
  id: string;
  code: string;
  discount_amount_myr: number;
  redeemed_at: string;
};

export async function loadCustomerCouponRedemptions(
  supabase: SupabaseClient,
  businessId: string,
  customerId: string,
): Promise<CustomerCouponRedemption[]> {
  const { data, error } = await supabase
    .from("coupon_redemptions")
    .select(
      "id, discount_amount_myr, redeemed_at, coupons!inner(code, business_id)",
    )
    .eq("customer_id", customerId)
    .eq("coupons.business_id", businessId)
    .order("redeemed_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const coupon = Array.isArray(row.coupons) ? row.coupons[0] : row.coupons;
    return {
      id: row.id as string,
      code: (coupon as { code?: string } | null)?.code ?? "—",
      discount_amount_myr: Number(row.discount_amount_myr),
      redeemed_at: row.redeemed_at as string,
    };
  });
}
