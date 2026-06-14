import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tierBy } from "@/lib/settings/plans";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/subscription — current plan + live usage.
 *
 * Returns:
 *   - business: tier, status, renewal_at, credit_balance
 *   - usage:
 *       - seats:        public.users where business_id and not removed
 *       - customers:    public.customers where business_id and live
 *       - creditsMonth: sum of credit_ledger.delta < 0 since start of cycle
 *   - quotas from the tier catalog
 */
export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const [businessRes, seatsRes, customersRes, creditsRes] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "tier, subscription_status, subscription_renewal_at, credit_balance",
      )
      .eq("id", user.businessId)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("business_id", user.businessId),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .is("merged_into_id", null),
    supabase
      .from("credit_ledger")
      .select("delta")
      .eq("business_id", user.businessId)
      .lt("delta", 0)
      .gte(
        "created_at",
        new Date(new Date().setDate(1)).toISOString(), // start of month
      ),
  ]);

  if (businessRes.error || !businessRes.data) {
    return NextResponse.json(
      { error: "load_failed", message: businessRes.error?.message },
      { status: 500 },
    );
  }

  const tier = tierBy(businessRes.data.tier);
  const creditsUsedThisMonth = (creditsRes.data ?? []).reduce(
    (n, r) => n + Math.abs(r.delta as number),
    0,
  );

  return NextResponse.json(
    {
      tier: businessRes.data.tier,
      tierMeta: tier ?? null,
      subscription_status: businessRes.data.subscription_status,
      subscription_renewal_at: businessRes.data.subscription_renewal_at,
      credit_balance: businessRes.data.credit_balance,
      usage: {
        seats: seatsRes.count ?? 0,
        customers: customersRes.count ?? 0,
        credits_used_this_month: creditsUsedThisMonth,
      },
    },
    { status: 200 },
  );
}
