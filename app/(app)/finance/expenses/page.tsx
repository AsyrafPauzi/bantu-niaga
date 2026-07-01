import { redirect } from "next/navigation";
import { PillarStub } from "@/components/ui/pillar-stub";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadBusiness } from "@/lib/settings/business";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  const business = await loadBusiness(user.businessId);
  if (!business) redirect("/home");
  if (business.tier === "starter") {
    redirect("/settings/subscription?locked=finance-expenses");
  }

  return (
    <PillarStub
      pillar="Finance"
      surface="Expenses"
      description="Camera-first expense capture: snap a receipt, fill amount + category, save."
      baseFeatures={[
        "Quick-log fields: amount, category, vendor, date",
        "Receipt photo (stored under Admin Storage)",
        "Filter by date / category / payment method",
        "Auto-creates ledger entry",
      ]}
      primaryMode="mobile"
    />
  );
}
