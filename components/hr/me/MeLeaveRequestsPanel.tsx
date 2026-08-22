import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
  ModuleListPanelHeader,
} from "@/components/dashboard/module-list-panel";
import { ModuleListFilterChipLink } from "@/components/dashboard/module-list-search";
import { MeLeaveList } from "@/components/hr/me/MeLeaveList";
import type { HrLeaveRow } from "@/lib/hr/load";
import type { StaffMeLeaveStatusFilter } from "@/lib/hr/load";
import { ADMIN_DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

function buildLeaveHref(status: StaffMeLeaveStatusFilter): string {
  if (status === "all") return "/hr/me";
  return `/hr/me?status=${status}`;
}

export function MeLeaveRequestsPanel({
  rows,
  statusFilter,
  page,
  pageSize,
  total,
}: {
  rows: HrLeaveRow[];
  statusFilter: StaffMeLeaveStatusFilter;
  page: number;
  pageSize: number;
  total: number;
}) {
  const chips: { status: StaffMeLeaveStatusFilter; label: string }[] = [
    { status: "all", label: "All" },
    { status: "pending", label: "Pending" },
    { status: "approved", label: "Approved" },
    { status: "rejected", label: "Rejected" },
  ];

  return (
    <ModuleListPanel>
      <ModuleListPanelHeader
        title="Leave requests"
        subtitle="Your applications and decisions"
        action={
          <Link
            href="/hr/me/leave/new"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white",
              hrClasses.btnPrimary,
            )}
          >
            <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2} />
            Apply
          </Link>
        }
      />
      <ModuleListPanelFilters>
        <nav aria-label="Filter leave" className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <ModuleListFilterChipLink
              key={chip.status}
              href={buildLeaveHref(chip.status)}
              active={statusFilter === chip.status}
              accent="teal"
              label={chip.label}
            />
          ))}
        </nav>
      </ModuleListPanelFilters>
      <MeLeaveList rows={rows} emptyActionHref="/hr/me/leave/new" />
      <ListPagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath="/hr/me"
        searchParams={{
          status: statusFilter !== "all" ? statusFilter : undefined,
        }}
        defaultPageSize={ADMIN_DEFAULT_PAGE_SIZE}
      />
    </ModuleListPanel>
  );
}
