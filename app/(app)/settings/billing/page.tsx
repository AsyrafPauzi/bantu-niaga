import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SettingsPageHero } from "@/components/settings/SettingsPageHero";
import { BillingView } from "@/components/settings/BillingView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tierBy } from "@/lib/settings/plans";
import {
  ensureBillplzPaymentMethod,
  isBillplzConfigured,
} from "@/lib/settings/billing";
import { loadCreditRolloverPolicy } from "@/lib/settings/credit-rollover";

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
  const [businessRes, invoicesRes, creditPolicy] = await Promise.all([
    supabase
      .from("businesses")
      .select("tier, subscription_renewal_at, credit_balance")
      .eq("id", user.businessId)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select(
        "id, number, kind, period_label, amount_myr, tax_myr, status, paid_at, pdf_url, created_at",
        { count: "exact" },
      )
      .eq("business_id", user.businessId)
      .order("created_at", { ascending: false })
      .range(0, 9),
    loadCreditRolloverPolicy(user.businessId, supabase),
  ]);

  if (!businessRes.data) redirect("/settings");

  if (user.role === "owner") {
    try {
      await ensureBillplzPaymentMethod(supabase, user.businessId);
    } catch {
      // Non-fatal — top-up route will retry.
    }
  }
  const tier = tierBy(businessRes.data.tier);
  const nextCharge = tier?.priceMyr ?? 0;
  const canEdit = user.role === "owner";
  const billplzBypass = !isBillplzConfigured();
  const showBillplzDevNotice =
    billplzBypass && process.env.NODE_ENV === "development";

  return (
    <>
      <SettingsPageHero
        eyebrow="Settings · Account"
        title="Billing & payment"
        subcopy="Invoices, payment methods, and Fast Credits."
        cta={
          canEdit ? (
            <Link
              href="/settings/subscription"
              className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
            >
              Manage plan
            </Link>
          ) : (
            <Badge tone="warning">Read-only — owner role required</Badge>
          )
        }
      />

      <BillingView
        initialInvoices={invoicesRes.data ?? []}
        initialInvoiceTotal={invoicesRes.count ?? 0}
        creditPolicy={creditPolicy}
        tierLabel={tier?.label ?? "Free"}
        nextChargeMyr={nextCharge}
        nextRenewalAt={businessRes.data.subscription_renewal_at}
        canEdit={canEdit}
        billplzBypass={billplzBypass}
        showBillplzDevNotice={showBillplzDevNotice}
      />
    </>
  );
}
