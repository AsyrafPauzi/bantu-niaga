import { redirect } from "next/navigation";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { requirePillar } from "@/lib/auth/require-pillar";
import { HrNavAddonProvider } from "@/components/hr/layout/hr-nav-addon-context";
import { HR_ADDON_SLUGS } from "@/lib/hr/addon-nav";
import { loadAddonFeatureStates } from "@/lib/marketplace/addon-availability";

export default async function HrPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePillar("hr");

  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  const addonStates = await loadAddonFeatureStates(user.businessId, HR_ADDON_SLUGS);

  return <HrNavAddonProvider states={addonStates}>{children}</HrNavAddonProvider>;
}
