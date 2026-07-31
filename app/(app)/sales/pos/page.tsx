import { redirect } from "next/navigation";
import { PosCheckoutClient } from "@/components/sales/PosCheckoutClient";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUsePos } from "@/lib/sales/access";
import { loadSalesDashboard } from "@/lib/sales/dashboard";
import { loadBusiness } from "@/lib/settings/business";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const supabase = await createSupabaseServerClient();
  const dashboard = await loadSalesDashboard(supabase, user.businessId);

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
    <PosCheckoutClient
      businessName={business.name}
      sstEnabled={business.sst_enabled}
      sstRatePct={Number(business.sst_rate_pct ?? 0)}
      duitnowId={business.duitnow_id}
      duitnowQrUrl={business.duitnow_qr_url ?? null}
      canCheckout={canCheckout}
      todaySalesMyr={dashboard.summary.salesTodayMyr}
      todayTxnCount={dashboard.summary.txnToday}
      initialCustomerId={initialCustomerId}
      initialCustomerName={initialCustomerName}
      initialLeadId={initialLeadId}
      initialLeadName={initialLeadName}
      initialLeadPhone={initialLeadPhone}
    />
  );
}
