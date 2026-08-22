import { CheckCircle2, Circle } from "lucide-react";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
  ModuleListPanelHeader,
  MODULE_LIST_ROWS_CLASS,
} from "@/components/dashboard/module-list-panel";
import { ModuleListFilterChipLink } from "@/components/dashboard/module-list-search";
import { OnboardingProgressBar } from "@/components/hr/HrOnboardingProgress";
import type { HrOnboardingRow, StaffMeOnboardingFilter } from "@/lib/hr/load";
import {
  formatOnboardingProgress,
  onboardingProgressFromCounts,
  type OnboardingProgress,
} from "@/lib/hr/onboarding-progress";
import { ADMIN_DEFAULT_PAGE_SIZE } from "@/lib/pagination";

function buildFilterHref(filter: StaffMeOnboardingFilter): string {
  if (filter === "all") return "/hr/me/onboarding";
  return `/hr/me/onboarding?filter=${filter}`;
}

export function MeOnboardingPanel({
  rows,
  filter,
  page,
  pageSize,
  total,
  progressDone,
  progressTotal,
  progress,
}: {
  rows: HrOnboardingRow[];
  filter: StaffMeOnboardingFilter;
  page: number;
  pageSize: number;
  total: number;
  progressDone: number;
  progressTotal: number;
  progress: OnboardingProgress;
}) {
  const chips: { filter: StaffMeOnboardingFilter; label: string }[] = [
    { filter: "all", label: "All" },
    { filter: "open", label: "Open" },
    { filter: "done", label: "Done" },
  ];

  return (
    <div className="space-y-4">
      {progressTotal > 0 ? (
        <div className="rounded-xl border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              Progress
            </p>
            <p className="text-xs font-semibold tabular-nums text-[#0F766E] dark:text-teal-300">
              {formatOnboardingProgress(progress)} · {progressDone}/
              {progressTotal}
            </p>
          </div>
          <div className="mt-3">
            <OnboardingProgressBar progress={progress} />
          </div>
        </div>
      ) : null}

      <ModuleListPanel>
        <ModuleListPanelHeader
          title="Checklist"
          subtitle="HR marks items done as you complete them"
        />
        <ModuleListPanelFilters>
          <nav
            aria-label="Filter onboarding"
            className="flex flex-wrap gap-1.5"
          >
            {chips.map((chip) => (
              <ModuleListFilterChipLink
                key={chip.filter}
                href={buildFilterHref(chip.filter)}
                active={filter === chip.filter}
                accent="teal"
                label={chip.label}
              />
            ))}
          </nav>
        </ModuleListPanelFilters>

        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              {progressTotal === 0 ? "No checklist yet" : "Nothing in this filter"}
            </p>
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
              {progressTotal === 0
                ? "HR has not assigned onboarding tasks to your profile."
                : "Try another filter to see more items."}
            </p>
          </div>
        ) : (
          <ul className={MODULE_LIST_ROWS_CLASS}>
            {rows.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 px-4 py-3.5 sm:px-5"
              >
                {item.is_done ? (
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#0D9488]"
                    strokeWidth={2}
                  />
                ) : (
                  <Circle
                    className="mt-0.5 h-5 w-5 shrink-0 text-ink-subtle dark:text-cream-500"
                    strokeWidth={2}
                  />
                )}
                <p
                  className={
                    item.is_done
                      ? "text-sm text-ink-muted line-through dark:text-cream-500"
                      : "text-sm font-medium text-ink dark:text-cream-100"
                  }
                >
                  {item.label}
                </p>
              </li>
            ))}
          </ul>
        )}

        <ListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          basePath="/hr/me/onboarding"
          searchParams={{
            filter: filter !== "all" ? filter : undefined,
          }}
          defaultPageSize={ADMIN_DEFAULT_PAGE_SIZE}
        />
      </ModuleListPanel>
    </div>
  );
}
