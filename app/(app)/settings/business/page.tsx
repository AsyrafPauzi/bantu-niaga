import { redirect } from "next/navigation";
import { BusinessProfileView } from "@/components/settings/BusinessProfileView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadBusiness } from "@/lib/settings/business";

export const metadata = { title: "Business profile" };
export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const business = await loadBusiness(user.businessId);
  if (!business) redirect("/settings");

  return (
    <BusinessProfileView business={business} canEdit={user.role === "owner"} />
  );
}
