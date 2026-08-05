import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings/SettingsView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { STATE_LABELS } from "@/lib/hr/state-codes";
import { isStandaloneDeployment } from "@/lib/platform/deployment";
import { loadBusiness } from "@/lib/settings/business";
import {
  getSettingsNavGroups,
  shouldShowPlanAndBilling,
} from "@/lib/settings/nav";
import { tierBy } from "@/lib/settings/plans";

export const metadata = { title: "Settings" };

export const dynamic = "force-dynamic";

export default async function SettingsIndexPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const business = await loadBusiness(user.businessId);
  const tier = business?.tier ?? "starter";
  const tierMeta = tierBy(tier);
  const settingsGroups = getSettingsNavGroups({ role: user.role });
  const showPlan = shouldShowPlanAndBilling(
    isStandaloneDeployment(),
    user.role,
  );
  const stateLabel = business?.state_code
    ? (STATE_LABELS[business.state_code] ?? business.state_code)
    : null;

  return (
    <SettingsView
      businessName={business?.name ?? "Your business"}
      companyId={business?.idcompany ?? null}
      stateLabel={stateLabel}
      planLabel={tierMeta?.label ?? null}
      showPlan={showPlan}
      role={user.role}
      groups={settingsGroups}
    />
  );
}
