import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPillar } from "@/lib/auth/entitlements";
import type { TierKey } from "@/lib/settings/plans";

export type ActivationChecklistState = {
  hasCustomer: boolean;
  hasProduct: boolean | null;
  hasFirstJob: boolean;
  hasTeamInvite: boolean;
  showProducts: boolean;
};

export async function loadActivationChecklistState(
  businessId: string,
  tier: TierKey,
): Promise<ActivationChecklistState> {
  const supabase = await createSupabaseServerClient();
  const showProducts = hasPillar(tier, "operations");

  const [
    { data: business },
    { count: customerCount },
    { count: productCount },
    { count: memberCount },
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("activated_at, first_invoice_sent_at, first_pos_sale_at")
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("deleted_at", null),
    showProducts
      ? supabase
          .from("operations_products")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .is("deleted_at", null)
      : Promise.resolve({ count: null }),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
  ]);

  const hasFirstJob = Boolean(
    business?.activated_at ||
      business?.first_invoice_sent_at ||
      business?.first_pos_sale_at,
  );

  return {
    hasCustomer: (customerCount ?? 0) > 0,
    hasProduct: showProducts ? (productCount ?? 0) > 0 : null,
    hasFirstJob,
    hasTeamInvite: (memberCount ?? 0) > 1,
    showProducts,
  };
}

/** Super-admin KPI: paid businesses activated within 7 days of first_paid_at. */
export function activationWithinSevenDaysRate(rows: Array<{
  first_paid_at: string | null;
  activated_at: string | null;
}>): { eligible: number; activated: number; ratePct: number | null } {
  const eligible = rows.filter((r) => r.first_paid_at);
  let activated = 0;
  for (const r of eligible) {
    if (!r.activated_at || !r.first_paid_at) continue;
    const paid = new Date(r.first_paid_at).getTime();
    const act = new Date(r.activated_at).getTime();
    if (act - paid <= 7 * 24 * 60 * 60 * 1000) activated += 1;
  }
  return {
    eligible: eligible.length,
    activated,
    ratePct:
      eligible.length === 0
        ? null
        : Math.round((activated / eligible.length) * 1000) / 10,
  };
}
