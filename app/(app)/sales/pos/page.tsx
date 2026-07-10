import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PosCheckoutClient } from "@/components/sales/PosCheckoutClient";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUsePos } from "@/lib/sales/access";
import { loadBusiness } from "@/lib/settings/business";

export const metadata = { title: "POS" };
export const dynamic = "force-dynamic";

export default async function PosPage() {
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

  const canCheckout =
    user.role === "owner" ||
    user.role === "manager" ||
    user.role === "cashier";

  return (
    <div className="space-y-4 px-4 py-4 lg:px-8 lg:py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link
            href="/sales"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Sales
          </Link>
          <h1 className="text-xl font-bold text-ink dark:text-cream-100">
            Point of sale
          </h1>
          <p className="text-sm text-ink-muted">
            Tap products · cash or static DuitNow · receipt
          </p>
        </div>
      </div>

      <PosCheckoutClient
        businessName={business.name}
        sstEnabled={business.sst_enabled}
        sstRatePct={Number(business.sst_rate_pct ?? 0)}
        duitnowId={business.duitnow_id}
        duitnowQrUrl={business.duitnow_qr_url ?? null}
        canCheckout={canCheckout}
      />
    </div>
  );
}
