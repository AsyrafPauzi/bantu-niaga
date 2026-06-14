import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { BillingView } from "@/components/settings/BillingView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tierBy } from "@/lib/settings/plans";

export const metadata = { title: "Billing & payment" };
export const dynamic = "force-dynamic";

export default async function BillingSettingsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const [businessRes, methodsRes, invoicesRes] = await Promise.all([
    supabase
      .from("businesses")
      .select("tier, subscription_renewal_at, credit_balance")
      .eq("id", user.businessId)
      .maybeSingle(),
    supabase
      .from("payment_methods")
      .select(
        "id, kind, label, masked, owner_name, exp_month, exp_year, is_default, provider, created_at",
      )
      .eq("business_id", user.businessId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select(
        "id, number, kind, period_label, amount_myr, tax_myr, status, paid_at, pdf_url, created_at",
      )
      .eq("business_id", user.businessId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!businessRes.data) redirect("/settings");
  const tier = tierBy(businessRes.data.tier);
  const nextCharge = tier?.priceMyr ?? 0;
  const monthlyQuota = tier?.quotas.fastCreditsMonthly ?? 0;
  const canEdit = user.role === "owner";

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
        title="Billing & payment"
        description="Payment methods, invoices, and Fast Credits top-ups."
        action={
          canEdit ? (
            <Link
              href="/settings/subscription"
              className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
            >
              Manage plan
            </Link>
          ) : (
            <Badge tone="warning">Read-only — owner role required</Badge>
          )
        }
      />

      <BillingView
        initialMethods={methodsRes.data ?? []}
        initialInvoices={invoicesRes.data ?? []}
        creditBalance={businessRes.data.credit_balance}
        monthlyCreditQuota={Number.isFinite(monthlyQuota) ? monthlyQuota : 0}
        nextChargeMyr={nextCharge}
        nextRenewalAt={businessRes.data.subscription_renewal_at}
        canEdit={canEdit}
      />
    </div>
  );
}
