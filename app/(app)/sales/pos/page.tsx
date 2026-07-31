import { redirect } from "next/navigation";
import { PosCheckoutClient } from "@/components/sales/PosCheckoutClient";
import { SalesBackLink } from "@/components/sales/SalesBackLink";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUsePos } from "@/lib/sales/access";
import { loadBusiness } from "@/lib/settings/business";

export const metadata = { title: "POS" };
export const dynamic = "force-dynamic";

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canUsePos(user.role)) {
    redirect("/sales");
  }

  const business = await loadBusiness(user.businessId);
  if (!business) redirect("/sales");

  const sp = await searchParams;
  const initialCustomerId =
    typeof sp.customer_id === "string" ? sp.customer_id : undefined;
  const initialCustomerName =
    typeof sp.customer_name === "string" ? sp.customer_name : undefined;
  const initialLeadId =
    typeof sp.lead_id === "string" ? sp.lead_id : undefined;
  const initialLeadName =
    typeof sp.lead_name === "string" ? sp.lead_name : undefined;
  const initialLeadPhone =
    typeof sp.lead_phone === "string" ? sp.lead_phone : undefined;

  const canCheckout =
    user.role === "owner" ||
    user.role === "manager" ||
    user.role === "cashier";

  return (
    <div className="space-y-4 pb-8">
      <SalesBackLink />
      <div>
        <h1 className="text-xl font-bold text-ink dark:text-cream-100">
          Point of sale
        </h1>
        <p className="text-sm text-ink-muted">
          Tap products · cash or static DuitNow · receipt
        </p>
      </div>

      <PosCheckoutClient
        businessName={business.name}
        sstEnabled={business.sst_enabled}
        sstRatePct={Number(business.sst_rate_pct ?? 0)}
        duitnowId={business.duitnow_id}
        duitnowQrUrl={business.duitnow_qr_url ?? null}
        canCheckout={canCheckout}
        initialCustomerId={initialCustomerId}
        initialCustomerName={initialCustomerName}
        initialLeadId={initialLeadId}
        initialLeadName={initialLeadName}
        initialLeadPhone={initialLeadPhone}
      />
    </div>
  );
}
