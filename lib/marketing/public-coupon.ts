import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface PublicCouponOffer {
  code: string;
  name: string | null;
  type: "PCT" | "AMT";
  value: number;
  min_subtotal_myr: number;
  valid_from: string;
  valid_until: string | null;
  status: "active" | "paused" | "expired";
  business_name: string;
}

/**
 * Public coupon lookup by code. Uses service role (anon has no coupon RLS).
 * Only returns active, non-deleted, currently valid offers.
 * Exposes no internal IDs — safe for unauthenticated share pages.
 */
export async function loadPublicCouponByCode(
  rawCode: string,
): Promise<PublicCouponOffer | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code || code.length < 3 || code.length > 32) return null;
  if (!/^[A-Z0-9_-]+$/.test(code)) return null;

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("coupons")
    .select(
      "code, name, type, value, min_subtotal_myr, valid_from, valid_until, status, business_id",
    )
    .ilike("code", code)
    .is("deleted_at", null)
    .eq("status", "active")
    .limit(10);

  if (error || !data || data.length === 0) return null;

  const now = Date.now();
  const candidates = data.filter((row) => {
    const from = new Date(String(row.valid_from)).getTime();
    if (!Number.isNaN(from) && from > now) return false;
    if (row.valid_until) {
      const until = new Date(String(row.valid_until)).getTime();
      if (!Number.isNaN(until) && until < now) return false;
    }
    return true;
  });

  const row = candidates[0];
  if (!row) return null;

  const { data: business } = await admin
    .from("businesses")
    .select("name")
    .eq("id", row.business_id as string)
    .maybeSingle();

  return {
    code: String(row.code).toUpperCase(),
    name: (row.name as string | null) ?? null,
    type: row.type as "PCT" | "AMT",
    value: Number(row.value),
    min_subtotal_myr: Number(row.min_subtotal_myr ?? 0),
    valid_from: String(row.valid_from),
    valid_until: row.valid_until ? String(row.valid_until) : null,
    status: "active",
    business_name: (business?.name as string | undefined) ?? "Business",
  };
}
