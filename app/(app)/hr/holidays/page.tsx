import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrHolidayOverridesPanel } from "@/components/hr/HrHolidayOverridesPanel";
import { HrHolidaysView } from "@/components/hr/HrHolidaysView";
import { HrPublicHolidaysGate } from "@/components/hr/HrPublicHolidaysGate";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrHolidayOverrides } from "@/lib/hr/effective-calendar";
import { loadHrPublicHolidays } from "@/lib/hr/load";
import { hasPublicHolidaysAddon } from "@/lib/marketplace/entitlements";
import { loadBusiness } from "@/lib/settings/business";
import { STATE_LABELS } from "@/lib/hr/state-codes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Public holidays" };
export const dynamic = "force-dynamic";

export default async function HolidaysPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!canManageHrCore(user.role)) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-ink-muted dark:text-cream-400">
          You do not have access to HR holidays.
        </CardBody>
      </Card>
    );
  }

  const [business, holidays, addonActive] = await Promise.all([
    loadBusiness(user.businessId),
    loadHrPublicHolidays(user.businessId),
    hasPublicHolidaysAddon(user.businessId),
  ]);

  const supabase = await createSupabaseServerClient();
  const overrides = await loadHrHolidayOverrides(supabase, user.businessId);

  if (!addonActive) {
    return <HrPublicHolidaysGate />;
  }

  const hasState = Boolean(business?.state_code);
  const stateLabel = business?.state_code
    ? (STATE_LABELS[business.state_code] ?? business.state_code)
    : null;
  const year = new Date().getFullYear();

  return (
    <HrHolidaysView
      holidays={holidays}
      overrides={overrides}
      stateLabel={stateLabel}
      hasState={hasState}
      year={year}
    />
  );
}
