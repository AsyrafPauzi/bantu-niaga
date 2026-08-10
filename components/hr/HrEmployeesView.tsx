"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Plus,
  Search,
  UserPlus,
} from "lucide-react";
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
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import type { HrDocumentRow, HrEmployeeRow } from "@/lib/hr/load";
import { paginateArray, totalPages } from "@/lib/pagination";
import {
  getEmployeeSetupChecklist,
  isEmployeeProfileIncomplete,
} from "@/lib/hr/profile-completion";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

type StatusFilter = "all" | "active" | "inactive" | "incomplete";

const PAGE_SIZE = 10;
const FILTER_CHIP_ACTIVE =
  "border-[#0D9488] bg-[#0D9488] text-white shadow-sm";
const FILTER_CHIP_IDLE =
  "border-cream-300 bg-white text-ink-muted hover:border-teal-300 hover:text-teal-800 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400 dark:hover:border-teal-700 dark:hover:text-teal-200";

function employmentLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtJoined(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export interface HrEmployeesViewProps {
  employees: HrEmployeeRow[];
  documents: HrDocumentRow[];
}

export function HrEmployeesView({ employees, documents }: HrEmployeesViewProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.status === "active").length;
    const inactive = employees.filter(
      (e) => e.status === "inactive" || e.status === "terminated",
    ).length;
    const incomplete = employees.filter((e) =>
      isEmployeeProfileIncomplete(e, documents),
    ).length;
    return { total: employees.length, active, inactive, incomplete };
  }, [employees, documents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = employees.filter((e) => {
      if (statusFilter === "active" && e.status !== "active") return false;
      if (
        statusFilter === "inactive" &&
        e.status !== "inactive" &&
        e.status !== "terminated"
      ) {
        return false;
      }
      if (
        statusFilter === "incomplete" &&
        !isEmployeeProfileIncomplete(e, documents)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        e.full_name.toLowerCase().includes(q) ||
        e.role_title.toLowerCase().includes(q) ||
        (e.email?.toLowerCase().includes(q) ?? false) ||
        (e.employee_number?.toLowerCase().includes(q) ?? false)
      );
    });
    return list.sort((a, b) => {
      const aIncomplete = isEmployeeProfileIncomplete(a, documents);
      const bIncomplete = isEmployeeProfileIncomplete(b, documents);
      if (aIncomplete !== bIncomplete) return aIncomplete ? -1 : 1;
      return a.full_name.localeCompare(b.full_name, "en-MY");
    });
  }, [employees, documents, query, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const { items: pageItems, total: filteredTotal } = useMemo(
    () => paginateArray(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  const pageCount = totalPages(filteredTotal, PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const filters = useMemo(() => {
    const items: { key: StatusFilter; label: string; count: number }[] = [
      { key: "all", label: "All", count: stats.total },
      { key: "active", label: "Active", count: stats.active },
    ];
    if (stats.inactive > 0) {
      items.push({ key: "inactive", label: "Inactive", count: stats.inactive });
    }
    if (stats.incomplete > 0) {
      items.push({
        key: "incomplete",
        label: "Setup pending",
        count: stats.incomplete,
      });
    }
    return items;
  }, [stats]);

  const pageStart =
    filteredTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(filteredTotal, page * PAGE_SIZE);

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setPage(1);
  }

  const heroSub =
    stats.total === 0
      ? "Add someone to start tracking leave, documents, and onboarding."
      : stats.incomplete > 0
        ? `${stats.incomplete} profile${stats.incomplete === 1 ? "" : "s"} still need documents or contact details.`
        : `${stats.active} active staff — profiles are complete.`;

  return (
    <div className="space-y-6">
      <HrMobileSubnav />

      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border p-6 sm:p-7",
          hrClasses.heroBorder,
          hrClasses.heroBg,
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className={cn("text-xs font-semibold uppercase tracking-widest", hrClasses.textMuted)}>
              HR · Employees
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-[1.65rem]">
              {stats.total === 0
                ? "Build your team"
                : `${stats.total} on the roster`}
            </h1>
            <p className="mt-1.5 max-w-lg text-sm text-ink-muted dark:text-cream-400">
              {heroSub}
            </p>
          </div>
          <Link
            href="/hr/employees/new"
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition",
              hrClasses.btnPrimary,
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add employee
          </Link>
        </div>

      </section>

      {/* Roster */}
      <div>
        {employees.length === 0 ? (
          <EmptyRoster />
        ) : (
          <ModuleListPanel>
            <ModuleListPanelFilters>
              <nav
                aria-label="Filter employees"
                className="mb-3 flex flex-wrap gap-2"
              >
                {filters.map(({ key, label, count }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      statusFilter === key
                        ? FILTER_CHIP_ACTIVE
                        : FILTER_CHIP_IDLE,
                    )}
                  >
                    {label}
                    <span
                      className={cn(
                        "tabular-nums",
                        statusFilter === key
                          ? "text-white/90"
                          : "text-ink-subtle dark:text-cream-500",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </nav>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-cream-300 bg-cream-50/50 px-3 py-2.5 dark:border-hairline-dark dark:bg-panel-dark/60">
                  <Search
                    className="h-4 w-4 shrink-0 text-ink-muted"
                    strokeWidth={2}
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, role, number, or email…"
                    className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {query || statusFilter !== "all" ? (
                <p className="mt-3 text-xs font-medium text-teal-700 dark:text-teal-300">
                  Showing {filteredTotal} match{filteredTotal === 1 ? "" : "es"}
                  {statusFilter !== "all"
                    ? ` · ${filters.find((f) => f.key === statusFilter)?.label ?? statusFilter}`
                    : null}
                  {query ? ` · “${query}”` : null}
                </p>
              ) : null}
            </ModuleListPanelFilters>

            {filtered.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <p className="text-sm font-medium text-ink dark:text-cream-100">
                  No matches
                </p>
                <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                  Try a different search or filter.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <ModuleListTable>
                    <ModuleListTableHead>
                      <tr>
                        <th className="px-5 py-3 text-left">Employee</th>
                        <th className="px-3 py-3 text-left">Role</th>
                        <th className="px-3 py-3 text-left">Type</th>
                        <th className="px-3 py-3 text-left">Status</th>
                        <th className="px-3 py-3 text-left">Setup</th>
                        <th className="px-3 py-3 text-left">Email</th>
                        <th className="px-5 py-3 text-right">Joined</th>
                      </tr>
                    </ModuleListTableHead>
                    <ModuleListTableBody>
                      {pageItems.map((employee) => (
                        <EmployeeTableRow
                          key={employee.id}
                          employee={employee}
                          documents={documents}
                        />
                      ))}
                    </ModuleListTableBody>
                  </ModuleListTable>
                </div>

                <div className="divide-y divide-cream-200 lg:hidden dark:divide-hairline-dark">
                  {pageItems.map((employee) => (
                    <EmployeeMobileRow
                      key={employee.id}
                      employee={employee}
                      documents={documents}
                    />
                  ))}
                </div>

                {filteredTotal > PAGE_SIZE ? (
                  <ModuleListPanelFooter>
                    <p>
                      Showing {pageStart}–{pageEnd} of {filteredTotal}
                    </p>
                    <RosterPagination
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
        )}
      </div>

      <div className="pb-16 lg:pb-6" />
    </div>
  );
}

function statusTone(
  status: string,
): "success" | "warning" | "neutral" | "danger" {
  if (status === "active") return "success";
  if (status === "on_leave") return "warning";
  if (status === "terminated") return "danger";
  return "neutral";
}

function statusLabel(status: string): string {
  if (status === "terminated") return "Terminated";
  if (status === "inactive") return "Inactive";
  if (status === "on_leave") return "On leave";
  return "Active";
}

function EmployeeTableRow({
  employee,
  documents,
}: {
  employee: HrEmployeeRow;
  documents: HrDocumentRow[];
}) {
  const incomplete = isEmployeeProfileIncomplete(employee, documents);
  const pendingSetup = incomplete
    ? getEmployeeSetupChecklist(employee, documents).filter((i) => !i.done)
        .length
    : 0;

  return (
    <tr className={MODULE_LIST_TABLE_ROW_CLASS}>
      <td className="px-5 py-3">
        <Link
          href={`/hr/employees/${employee.id}`}
          className="flex items-center gap-3"
        >
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold uppercase",
              hrClasses.avatar,
            )}
          >
            {initials(employee.full_name)}
          </span>
          <div className="min-w-0">
            <span className="font-semibold text-ink hover:text-[#0D9488] dark:text-cream-100 dark:hover:text-teal-300">
              {employee.full_name}
            </span>
            {employee.employee_number ? (
              <p className="text-[11px] font-medium text-ink-muted dark:text-cream-500">
                {employee.employee_number}
              </p>
            ) : null}
          </div>
        </Link>
      </td>
      <td className="px-3 py-3 text-sm text-ink-muted dark:text-cream-400">
        {employee.role_title}
      </td>
      <td className="px-3 py-3 text-xs text-ink-muted dark:text-cream-400">
        {employmentLabel(employee.employment_type)}
      </td>
      <td className="px-3 py-3">
        <StatusPill tone={statusTone(employee.status)}>
          {statusLabel(employee.status)}
        </StatusPill>
      </td>
      <td className="px-3 py-3 text-xs">
        {incomplete ? (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {pendingSetup} pending
          </span>
        ) : (
          <span className="text-ink-subtle dark:text-cream-500">Complete</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-ink-muted dark:text-cream-400">
        {employee.email ?? "—"}
      </td>
      <td className="px-5 py-3 text-right text-xs text-ink-muted dark:text-cream-400">
        {fmtJoined(employee.start_date)}
      </td>
    </tr>
  );
}

function EmployeeMobileRow({
  employee,
  documents,
}: {
  employee: HrEmployeeRow;
  documents: HrDocumentRow[];
}) {
  const incomplete = isEmployeeProfileIncomplete(employee, documents);

  return (
    <Link
      href={`/hr/employees/${employee.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-cream-50 dark:hover:bg-panel-dark/60"
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase",
          hrClasses.avatar,
        )}
      >
        {initials(employee.full_name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
            {employee.full_name}
          </p>
          <StatusPill tone={statusTone(employee.status)}>
            {statusLabel(employee.status)}
          </StatusPill>
        </div>
        <p className="truncate text-xs text-ink-muted dark:text-cream-400">
          {employee.employee_number ? (
            <span className="font-medium text-ink-muted dark:text-cream-300">
              {employee.employee_number}
              <span className="mx-1 text-ink-subtle">·</span>
            </span>
          ) : null}
          {employee.role_title} · {employmentLabel(employee.employment_type)}
        </p>
        {incomplete ? (
          <p className="mt-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
            Setup pending
          </p>
        ) : null}
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-subtle" />
    </Link>
  );
}

function RosterPagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
  embedded,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
  embedded?: boolean;
}) {
  const pages = totalPages(total, pageSize);
  if (total === 0 || total <= pageSize) return null;

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
      <PaginationButton
        disabled={page <= 1}
        label="Previous page"
        onClick={() => onPageChange(page - 1)}
      >
        ‹
      </PaginationButton>
      {pageNums.map((n) => (
        <PaginationButton
          key={n}
          disabled={false}
          label={`Page ${n}`}
          active={n === page}
          onClick={() => onPageChange(n)}
        >
          {n}
        </PaginationButton>
      ))}
      <PaginationButton
        disabled={page >= pages}
        label="Next page"
        onClick={() => onPageChange(page + 1)}
      >
        ›
      </PaginationButton>
    </div>
  );

  if (embedded) return controls;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-cream-200 px-4 py-3 text-xs text-ink-muted dark:border-hairline-dark dark:text-cream-400",
        className,
      )}
    >
      <span>
        Showing {start}–{end} of {total}
      </span>
      {controls}
    </div>
  );
}

function PaginationButton({
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
      <span
        aria-label={label}
        className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-cream-200 px-2 text-xs opacity-40 dark:border-hairline-dark"
      >
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

function EmptyRoster() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-teal-200/80 bg-teal-50/20 px-6 py-16 text-center dark:border-teal-900 dark:bg-teal-950/15">
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", hrClasses.iconBox)}>
        <UserPlus className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <p className="mt-4 text-base font-semibold text-ink dark:text-cream-100">
        No employees yet
      </p>
      <p className="mt-1 max-w-sm text-sm text-ink-muted dark:text-cream-400">
        One profile per person — leave balances, documents, and onboarding all live here.
      </p>
      <Link
        href="/hr/employees/new"
        className={cn(
          "mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold",
          hrClasses.btnPrimary,
        )}
      >
        <Plus className="h-4 w-4" />
        Add first employee
      </Link>
    </div>
  );
}
