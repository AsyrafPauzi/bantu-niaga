import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
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
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to settings
      </Link>

      <PageHeader
        eyebrow="Settings · Account"
        title="Subscription plan"
        description="Pick the tier that matches your business size. All changes are prorated to the next renewal date."
        action={
          <Link
            href="/settings/billing"
            className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
          >
            <Receipt className="h-4 w-4" strokeWidth={2} />
            View invoices
          </Link>
        }
      />

      <p className="text-sm text-ink-muted dark:text-cream-400">
        Not sure which plan fits?{" "}
        <Link
          href="/sign-up/guide"
          className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
        >
          Take the 30-second business quiz
        </Link>
        .
      </p>

      <SubscriptionView
        tier={tier}
        subscriptionRenewalAt={business.subscription_renewal_at}
        usage={{
          seats: seatsRes.count ?? 0,
          customers: customersRes.count ?? 0,
          credits_used_this_month: creditsUsed,
        }}
        canEdit={user.role === "owner"}
        lockedPillar={locked}
      />
    </div>
  );
}
