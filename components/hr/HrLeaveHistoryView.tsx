"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { HrLeaveRecordRow } from "@/components/hr/HrLeaveRecordRow";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
  ModuleListPanelFooter,
  ModuleListTable,
  ModuleListTableBody,
  ModuleListTableHead,
  MODULE_LIST_TABLE_ROW_CLASS,
} from "@/components/dashboard/module-list-panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  ModuleListFilterChipButton,
} from "@/components/dashboard/module-list-search";
import type { HrEmployeeRow, HrLeaveRow } from "@/lib/hr/load";
import {
  leaveTypeBadgeClass,
  leaveTypeLabel,
  leaveTypeShort,
} from "@/lib/hr/leave-labels";
import { paginateArray, totalPages } from "@/lib/pagination";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const PAGE_SIZE = 10;

export interface HrLeaveHistoryViewProps {
  leave: HrLeaveRow[];
  employee?: HrEmployeeRow | null;
}

export function HrLeaveHistoryView({ leave, employee }: HrLeaveHistoryViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const stats = useMemo(() => {
    const pending = leave.filter((r) => r.status === "pending").length;
    const approved = leave.filter((r) => r.status === "approved").length;
    const rejected = leave.filter((r) => r.status === "rejected").length;
    return { total: leave.length, pending, approved, rejected };
  }, [leave]);

  const filtered = useMemo(() => {
    const list =
      statusFilter === "all"
        ? leave
        : leave.filter((r) => r.status === statusFilter);
    return list;
  }, [leave, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const { items: pageItems, total: filteredTotal } = useMemo(
    () => paginateArray(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  const pageCount = totalPages(filteredTotal, PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "pending", label: "Pending", count: stats.pending },
    { key: "approved", label: "Approved", count: stats.approved },
  ];
  if (stats.rejected > 0) {
    filters.push({ key: "rejected", label: "Rejected", count: stats.rejected });
  }

  const backHref = employee ? `/hr/employees/${employee.id}?tab=leave` : "/hr/leave";
  const backLabel = employee ? "Back to employee" : "Back to leave";

  return (
    <div className="space-y-6">
      <HrMobileSubnav />

      <Link
        href={backHref}
        className={cn("inline-flex items-center gap-1.5 text-sm", hrClasses.link)}
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <section
        className={cn(
          "relative mt-3 overflow-hidden rounded-xl border p-4 shadow-sm sm:p-5",
          hrClasses.heroBorder,
          hrClasses.heroBg,
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className={cn("text-[11px] font-semibold uppercase tracking-widest", hrClasses.textMuted)}>
              HR · {employee ? "Employee leave" : "Leave history"}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
              {employee ? employee.full_name : `${stats.total} on file`}
            </h1>
            <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
              {employee
                ? `${employee.role_title} · ${stats.total} record${stats.total === 1 ? "" : "s"}`
                : "Pending, approved, and rejected leave for your team"}
            </p>
          </div>
          <Link
            href={
              employee
                ? `/hr/leave/record?employee_id=${employee.id}`
                : "/hr/leave/record"
            }
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition",
              hrClasses.btnPrimary,
            )}
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Record leave
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Total", value: stats.total, sub: "records" },
            {
              label: "Pending",
              value: stats.pending,
              sub: "awaiting",
              highlight: stats.pending > 0,
            },
            { label: "Approved", value: stats.approved, sub: "on file" },
            {
              label: "Rejected",
              value: stats.rejected,
              sub: "declined",
              highlight: stats.rejected > 0,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-cream-200/80 bg-white/90 px-2.5 py-2 dark:border-hairline-dark dark:bg-panel-dark/80"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-500">
                {stat.label}
              </p>
              <p
                className={cn(
                  "text-xl font-bold tabular-nums leading-tight",
                  stat.highlight ? "text-amber-700 dark:text-amber-300" : hrClasses.text,
                )}
              >
                {stat.value}
              </p>
              <p className="text-[10px] text-ink-muted dark:text-cream-500">{stat.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <ModuleListPanel as="section">
        <ModuleListPanelFilters>
          <nav
            aria-label="Filter leave status"
            className="mb-3 flex flex-wrap gap-2"
          >
            {filters.map(({ key, label, count }) => (
              <ModuleListFilterChipButton
                key={key}
                active={statusFilter === key}
                accent="teal"
                label={label}
                count={count}
                onClick={() => setStatusFilter(key)}
              />
            ))}
          </nav>
        </ModuleListPanelFilters>

        {filteredTotal === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-ink-muted dark:text-cream-400">
              No leave records in this filter.
            </p>
            <Link
              href={
                employee
                  ? `/hr/leave/record?employee_id=${employee.id}`
                  : "/hr/leave/record"
              }
              className={cn("mt-2 inline-flex text-sm font-semibold", hrClasses.link)}
            >
              Record leave
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <ModuleListTable>
                <ModuleListTableHead>
                  <tr>
                    {!employee ? (
                      <th className="px-5 py-3 text-left">Employee</th>
                    ) : null}
                    <th className="px-3 py-3 text-left">Type</th>
                    <th className="px-3 py-3 text-left">Dates</th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Reason</th>
                  </tr>
                </ModuleListTableHead>
                <ModuleListTableBody>
                  {pageItems.map((row) => (
                    <LeaveTableRow
                      key={row.id}
                      row={row}
                      hideEmployeeName={Boolean(employee)}
                    />
                  ))}
                </ModuleListTableBody>
              </ModuleListTable>
            </div>
            <div className="divide-y divide-cream-200 lg:hidden dark:divide-hairline-dark">
              {pageItems.map((row) => (
                <HrLeaveRecordRow
                  key={row.id}
                  row={row}
                  showStatus
                  hideEmployeeName={Boolean(employee)}
                  showManageActions
                />
              ))}
            </div>
            {filteredTotal > PAGE_SIZE ? (
              <ModuleListPanelFooter>
                <p>
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(filteredTotal, page * PAGE_SIZE)} of {filteredTotal}
                </p>
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={filteredTotal}
                  onPageChange={setPage}
                  embedded
                />
              </ModuleListPanelFooter>
            ) : null}
          </>
        )}
      </ModuleListPanel>

      <div className="pb-16 lg:pb-6" />
    </div>
  );
}

function fmtLeaveDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

function leaveStatusTone(
  status: string,
): "success" | "warning" | "neutral" {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  return "neutral";
}

function LeaveTableRow({
  row,
  hideEmployeeName,
}: {
  row: HrLeaveRow;
  hideEmployeeName: boolean;
}) {
  const reason = row.reason?.trim() ? row.reason.trim() : "—";
  return (
    <tr className={MODULE_LIST_TABLE_ROW_CLASS}>
      {!hideEmployeeName ? (
        <td className="px-5 py-3 text-sm font-semibold text-ink dark:text-cream-100">
          {row.hr_employees?.full_name ?? "Employee"}
        </td>
      ) : null}
      <td className="px-3 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${leaveTypeBadgeClass(row.leave_type)}`}
        >
          {leaveTypeShort(row.leave_type)}
        </span>
        <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
          {leaveTypeLabel(row.leave_type)}
        </p>
      </td>
      <td className="px-3 py-3 text-xs text-ink-muted dark:text-cream-400">
        {fmtLeaveDate(row.start_date)}
        {row.end_date !== row.start_date
          ? ` – ${fmtLeaveDate(row.end_date)}`
          : ""}
      </td>
      <td className="px-3 py-3">
        <StatusPill tone={leaveStatusTone(row.status)}>
          {row.status}
        </StatusPill>
      </td>
      <td className="max-w-xs truncate px-5 py-3 text-xs text-ink-muted dark:text-cream-400">
        {reason}
      </td>
    </tr>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  embedded,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  embedded?: boolean;
}) {
  if (total <= pageSize) return null;

  const pages = totalPages(total, pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const pageNums: number[] = [];
  const maxButtons = 5;
  let rangeStart = Math.max(1, page - 2);
  let rangeEnd = Math.min(pages, rangeStart + maxButtons - 1);
  rangeStart = Math.max(1, rangeEnd - maxButtons + 1);
  for (let n = rangeStart; n <= rangeEnd; n += 1) pageNums.push(n);

  const controls = (
    <div className="flex items-center gap-1">
      <PageBtn disabled={page <= 1} label="Previous" onClick={() => onPageChange(page - 1)}>
        ‹
      </PageBtn>
      {pageNums.map((n) => (
        <PageBtn
          key={n}
          disabled={false}
          label={`Page ${n}`}
          active={n === page}
          onClick={() => onPageChange(n)}
        >
          {n}
        </PageBtn>
      ))}
      <PageBtn
        disabled={page >= pages}
        label="Next"
        onClick={() => onPageChange(page + 1)}
      >
        ›
      </PageBtn>
    </div>
  );

  if (embedded) return controls;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cream-200 px-4 py-3 text-xs text-ink-muted dark:border-hairline-dark dark:text-cream-400">
      <span>
        Showing {start}–{end} of {total}
      </span>
      {controls}
    </div>
  );
}

function PageBtn({
  children,
  disabled,
  label,
  active,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-cream-200 px-2 opacity-40 dark:border-hairline-dark">
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors",
        active
          ? "border-[#0D9488] bg-teal-50 text-[#0F766E] dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-200"
          : "border-cream-300 text-ink hover:bg-cream-100 dark:border-hairline-dark dark:text-cream-100 dark:hover:bg-panel-dark",
      )}
    >
      {children}
    </button>
  );
}
