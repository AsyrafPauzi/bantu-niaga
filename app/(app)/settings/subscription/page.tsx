import { redirect } from "next/navigation";
import { SubscriptionPageHero } from "@/components/settings/SubscriptionPageHero";
import { SubscriptionView } from "@/components/settings/SubscriptionView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Subscription plan" };
export const dynamic = "force-dynamic";

export default async function SubscriptionPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ locked?: string }>;
}) {
  const { locked } = await searchParams;
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const startOfMonth = new Date(new Date().setDate(1));
  startOfMonth.setHours(0, 0, 0, 0);

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
      .gte("created_at", startOfMonth.toISOString()),
  ]);

  if (!businessRes.data) redirect("/settings");
  const business = businessRes.data;
  const creditsUsed = (creditsRes.data ?? []).reduce(
    (n, r) => n + Math.abs(r.delta as number),
    0,
  );
  const tier = business.tier as
    | "starter"
    | "micro"
    | "sme"
    | "enterprise";

  return (
    <>
      <SubscriptionPageHero />

      <SubscriptionView
        tier={tier}
        subscriptionStatus={
          business.subscription_status as
            | "active"
            | "past_due"
            | "cancelled"
            | "trial"
        }
        subscriptionRenewalAt={business.subscription_renewal_at}
        usage={{
          seats: seatsRes.count ?? 0,
          customers: customersRes.count ?? 0,
          credits_used_this_month: creditsUsed,
        }}
        canEdit={user.role === "owner"}
        lockedPillar={locked}
      />
    </>
  );
}
