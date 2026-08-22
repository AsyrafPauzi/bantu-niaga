import Link from "next/link";
import { Download, Wallet } from "lucide-react";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
  ModuleListPanelHeader,
  MODULE_LIST_ROWS_CLASS,
} from "@/components/dashboard/module-list-panel";
import { ModuleListFilterChipLink } from "@/components/dashboard/module-list-search";
import { formatMyr } from "@/lib/finance/schemas";
import {
  formatPayslipPeriodLabel,
  type HrPayslipRow,
} from "@/lib/hr/payslips";
import { ADMIN_DEFAULT_PAGE_SIZE } from "@/lib/pagination";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

function buildYearHref(year: number | "all"): string {
  if (year === "all") return "/hr/me/payslips";
  return `/hr/me/payslips?year=${year}`;
}

export function MePayslipsPanel({
  rows,
  yearFilter,
  yearOptions,
  page,
  pageSize,
  total,
}: {
  rows: HrPayslipRow[];
  yearFilter: number | "all";
  yearOptions: number[];
  page: number;
  pageSize: number;
  total: number;
}) {
  return (
    <ModuleListPanel>
      <ModuleListPanelHeader
        title="Payslips"
        subtitle="Download PDF for each period"
      />
      {yearOptions.length > 0 ? (
        <ModuleListPanelFilters>
          <nav aria-label="Filter by year" className="flex flex-wrap gap-1.5">
            <ModuleListFilterChipLink
              href={buildYearHref("all")}
              active={yearFilter === "all"}
              accent="teal"
              label="All years"
            />
            {yearOptions.map((year) => (
              <ModuleListFilterChipLink
                key={year}
                href={buildYearHref(year)}
                active={yearFilter === year}
                accent="teal"
                label={String(year)}
              />
            ))}
          </nav>
        </ModuleListPanelFilters>
      ) : null}

      {rows.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cream-100 text-[#0F766E] dark:bg-hairline-dark dark:text-teal-300">
            <Wallet className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-3 text-sm font-semibold text-ink dark:text-cream-100">
            No payslips yet
          </p>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            When HR publishes a payslip, it will show up here to download.
          </p>
        </div>
      ) : (
        <ul className={MODULE_LIST_ROWS_CLASS}>
          {rows.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink dark:text-cream-100">
                  {formatPayslipPeriodLabel(item.period_start)}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                  {fmtDate(item.period_start)} – {fmtDate(item.period_end)}
                  <span className="mx-1">·</span>
                  Net {formatMyr(item.net_myr)}
                </p>
              </div>
              <Link
                href={`/api/hr/payslips/${encodeURIComponent(item.id)}/pdf`}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-cream-300 px-3 py-2 text-xs font-semibold text-[#0F766E] transition hover:bg-cream-50 dark:border-hairline-dark dark:text-teal-300 dark:hover:bg-hairline-dark"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2} />
                PDF
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ListPagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath="/hr/me/payslips"
        searchParams={{
          year: yearFilter !== "all" ? String(yearFilter) : undefined,
        }}
        defaultPageSize={ADMIN_DEFAULT_PAGE_SIZE}
      />
    </ModuleListPanel>
  );
}
