import { redirect } from "next/navigation";
import { FinanceGuideJourney } from "@/components/finance/FinanceGuideJourney";
import { FinanceOverview } from "@/components/finance/FinanceOverview";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { loadBusiness } from "@/lib/settings/business";
import { loadFinanceDashboardCached } from "@/lib/cache/dashboard-cache";

export const metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!can(user.role, "finance")) {
    redirect("/home");
  }

  const params = await searchParams;
  const month =
    typeof params.month === "string" && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : undefined;

  const business = await loadBusiness(user.businessId);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const data = await loadFinanceDashboardCached(user.businessId, {
    month,
    idcompany: business?.idcompany ?? "",
    appUrl,
  });

  const expensesAllowed = business?.tier !== "starter";

  return (
    <div className="space-y-4">
      <FinanceGuideJourney businessId={user.businessId} />
      <FinanceOverview
        data={data}
        businessName={business?.name ?? "us"}
        expensesAllowed={expensesAllowed}
      />
    </div>
  );
}
