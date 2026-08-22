import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { MeOnboardingPanel } from "@/components/hr/me/MeOnboardingPanel";
import { MePageFrame } from "@/components/hr/me/MePageFrame";
import {
  loadStaffMeOnboardingItems,
  loadStaffMeOnboardingItemsPage,
  type StaffMeOnboardingFilter,
} from "@/lib/hr/load";
import {
  onboardingProgressFromCounts,
} from "@/lib/hr/onboarding-progress";
import { resolveStaffMePage } from "@/lib/hr/staff-self-service";
import { ADMIN_DEFAULT_PAGE_SIZE, parsePagination } from "@/lib/pagination";

export const metadata = { title: "Onboarding" };
export const dynamic = "force-dynamic";

function parseFilter(
  raw: string | string[] | undefined,
): StaffMeOnboardingFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "open" || value === "done") return value;
  return "all";
}

export default async function HrMeOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await resolveStaffMePage();
  if (!ctx) return null;

  const params = await searchParams;
  const pagination = parsePagination(params, {
    defaultPageSize: ADMIN_DEFAULT_PAGE_SIZE,
  });
  const filter = parseFilter(params.filter);

  const [allItems, pageResult] = await Promise.all([
    loadStaffMeOnboardingItems(ctx.user.businessId, ctx.employee.id),
    loadStaffMeOnboardingItemsPage(ctx.user.businessId, ctx.employee.id, {
      filter,
      from: pagination.from,
      to: pagination.to,
    }),
  ]);

  const done = allItems.filter((item) => item.is_done).length;
  const progress = onboardingProgressFromCounts(done, allItems.length);
  const open = Math.max(0, allItems.length - done);

  return (
    <MePageFrame
      pathname="/hr/me/onboarding"
      title="Onboarding"
      subtitle="Tasks HR set when you joined — they mark items done"
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <ModuleHeroStat
            label="Progress"
            value={allItems.length === 0 ? "—" : `${progress.percent}%`}
            pillar="hr"
            iconClassName="text-[#0F766E] dark:text-teal-300"
          />
          <ModuleHeroStat
            label="Open"
            value={open}
            pillar="hr"
            iconClassName="text-amber-700 dark:text-amber-300"
          />
          <ModuleHeroStat
            label="Done"
            value={done}
            pillar="hr"
            iconClassName="text-sky-700 dark:text-sky-300"
          />
        </div>
      }
    >
      <MeOnboardingPanel
        rows={pageResult.rows}
        filter={filter}
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pageResult.total}
        progressDone={done}
        progressTotal={allItems.length}
        progress={progress}
      />
    </MePageFrame>
  );
}
