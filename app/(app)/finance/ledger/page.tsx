import { redirect } from "next/navigation";
import { PillarStub } from "@/components/ui/pillar-stub";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadBusiness } from "@/lib/settings/business";

export const metadata = { title: "Ledger" };

export default async function LedgerPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  const business = await loadBusiness(user.businessId);
  if (!business) redirect("/home");
  const isFree = business.tier === "starter";

  return (
    <PillarStub
      pillar="Finance"
      surface="Ledger"
      description={
        isFree
          ? "Finance Lite ledger — chronological list of income, invoices, and payment status. Expense tracking unlocks on Starter."
          : "Simplified digital transaction ledger — chronological list of all entries with running balance and quick monthly summary."
      }
      baseFeatures={
        isFree
          ? [
              "Chronological income and payment entries",
              "Invoice payment status",
              "Filters: date range and payment method",
              "Quick monthly income summary",
            ]
          : [
              "Chronological revenue + expense entries",
              "Running balance",
              "Filters: date range, category, payment method",
              "Quick monthly summary card (in / out / net)",
            ]
      }
      primaryMode="desktop"
    />
  );
}
