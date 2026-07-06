import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { SectionCard } from "@/components/dashboard/section-card";
import { HolidaysNoState } from "@/components/hr/HolidaysNoState";
import { HrHolidayCreateForm } from "@/components/hr/HrHolidayCreateForm";
import { HrInfoBanner } from "@/components/hr/layout/hr-info-banner";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrPublicHolidays } from "@/lib/hr/load";
import { loadBusiness } from "@/lib/settings/business";

export const metadata = { title: "Public holidays" };
export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

const STATE_LABELS: Record<string, string> = {
  JHR: "Johor",
  KDH: "Kedah",
  KTN: "Kelantan",
  KUL: "Kuala Lumpur",
  LBN: "Labuan",
  MLK: "Melaka",
  NSN: "Negeri Sembilan",
  PHG: "Pahang",
  PRK: "Perak",
  PLS: "Perlis",
  PNG: "Penang",
  SBH: "Sabah",
  SWK: "Sarawak",
  SGR: "Selangor",
  TRG: "Terengganu",
  PJY: "Putrajaya",
};

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

  const [business, holidays] = await Promise.all([
    loadBusiness(user.businessId),
    loadHrPublicHolidays(user.businessId),
  ]);
  const hasState = Boolean(business?.state_code);
  const upcoming = holidays.filter(
    (h) => h.holiday_date >= new Date().toISOString().slice(0, 10),
  );
  const stateLabel = business?.state_code
    ? STATE_LABELS[business.state_code] ?? business.state_code
    : null;

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Public holidays"
          subtitle="See company holidays and import them by your business state"
          helpHref="/more"
          action={
            hasState ? (
              <Link
                href="#add-holiday"
                className="inline-flex items-center justify-center rounded-[10px] bg-brand-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Add holiday
              </Link>
            ) : undefined
          }
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <SectionCard
            title="Company holiday calendar"
            subtitle="Federal and state holidays used for leave planning"
          >
            <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {upcoming.length === 0 ? (
                <p className="py-4 text-sm text-ink-muted dark:text-cream-400">
                  No upcoming public holidays recorded.
                </p>
              ) : (
                upcoming.map((holiday) => (
                  <div
                    key={holiday.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink dark:text-cream-100">
                        {holiday.name}
                      </p>
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        {holiday.state_code
                          ? STATE_LABELS[holiday.state_code] ?? holiday.state_code
                          : "All states"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-ink-muted dark:text-cream-400">
                      {fmtDate(holiday.holiday_date)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <div className="space-y-4">
            {hasState ? (
              <>
                <SectionCard
                  title="Import public holidays"
                  subtitle="Based on your business state in Settings"
                  id="add-holiday"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-[14px] border border-[#E5E0D8] bg-white p-5 dark:border-hairline-dark dark:bg-panel-dark">
                      <div>
                        <p className="text-sm font-semibold text-ink dark:text-cream-100">
                          Business state
                        </p>
                        <p className="text-xs text-ink-muted dark:text-cream-400">
                          {stateLabel}
                        </p>
                      </div>
                      <Link
                        href="/settings"
                        className="text-xs font-semibold text-brand-700 dark:text-brand-200"
                      >
                        Change
                      </Link>
                    </div>
                    <HrInfoBanner
                      title="Auto-import is ready"
                      description={`We will fetch federal and ${stateLabel} public holidays for ${new Date().getFullYear()}. You can still add your own company holidays below.`}
                    />
                    <HrHolidayCreateForm />
                  </div>
                </SectionCard>
              </>
            ) : (
              <HolidaysNoState />
            )}
          </div>
        </div>
      </HrPageBody>
    </HrPageShell>
  );
}
