import { redirect } from "next/navigation";
import { FinanceGuideJourney } from "@/components/finance/FinanceGuideJourney";
import { FinanceMobileExpenseFab } from "@/components/finance/FinanceMobileExpenseFab";
import { FinanceOverview } from "@/components/finance/FinanceOverview";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { loadFinanceDashboard } from "@/lib/finance/dashboard";
import { loadBusiness } from "@/lib/settings/business";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const [business, supabase] = await Promise.all([
    loadBusiness(user.businessId),
    createSupabaseServerClient(),
  ]);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  const data = await loadFinanceDashboard(supabase, user.businessId, {
    month,
    idcompany: business?.idcompany ?? "",
    appUrl,
  });

  return (
    <div className="space-y-4">
      <FinanceGuideJourney businessId={user.businessId} />
      <FinanceOverview
        data={data}
        businessName={business?.name ?? "us"}
      />
      <FinanceMobileExpenseFab />
    </div>
  );
}
