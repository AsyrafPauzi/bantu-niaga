"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CalendarPlus,
  FileText,
  History,
  Link2,
  ListChecks,
  Mail,
  Phone,
  User,
} from "lucide-react";
import { HrLeaveBalanceStrip } from "@/components/hr/HrLeaveBalanceStrip";
import { HrDocumentCreateForm } from "@/components/hr/HrDocumentCreateForm";
import { HrEmployeeUpdateForm } from "@/components/hr/HrEmployeeUpdateForm";
import { HrLeaveLinkActions } from "@/components/hr/HrLeaveLinkActions";
import { HrLeaveRecordRow } from "@/components/hr/HrLeaveRecordRow";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrOnboardingPanel } from "@/components/hr/HrOnboardingPanel";
import { HrSetupChecklist } from "@/components/hr/HrSetupChecklist";
import { HrWarningLettersSection } from "@/components/hr/HrWarningLettersSection";
import type {
  HrDocumentRow,
  HrEmployeeLeaveBalance,
  HrEmployeeRow,
  HrLeaveRow,
  HrOnboardingRow,
} from "@/lib/hr/load";
import type { HrWarningLetterRow } from "@/lib/hr/warning-letters-shared";
import {
  buildLeaveBalanceLines,
  countApprovedLeaveDaysByType,
} from "@/lib/hr/leave-balance-display";
import {
  documentTypeLabel,
  getEmployeeSetupChecklist,
  isSetupChecklistComplete,
  type SetupChecklistItem,
} from "@/lib/hr/profile-completion";
import { computeOnboardingProgress } from "@/lib/hr/onboarding-progress";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

type TabId = "profile" | "documents" | "onboarding" | "leave";

function employmentLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtJoined(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtSalaryMyr(amount: number): string {
  return `RM ${amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusChipClass(status: string): string {
  if (status === "active") {
    return "bg-teal-50 text-[#0F766E] ring-teal-200/80 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-800";
  }
  if (status === "terminated") {
    return "bg-red-50 text-red-800 ring-red-200/80 dark:bg-red-950/30 dark:text-red-200 dark:ring-red-900";
  }
  return "bg-cream-100 text-ink-muted ring-cream-200 dark:bg-hairline-dark dark:text-cream-400 dark:ring-hairline-dark";
}

export interface HrEmployeeProfileViewProps {
  employee: HrEmployeeRow;
  documents: HrDocumentRow[];
  onboarding: HrOnboardingRow[];
  leaveBalance: HrEmployeeLeaveBalance;
  leaveRecords: HrLeaveRow[];
  warningLetters: HrWarningLetterRow[];
}

export function HrEmployeeProfileView({
  employee,
  documents,
  onboarding,
  leaveBalance,
  leaveRecords,
  warningLetters,
}: HrEmployeeProfileViewProps) {
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";
  const tabParam = searchParams.get("tab");
  const leaveLinkParam = searchParams.get("leave_link") === "1";
  const [tab, setTab] = useState<TabId>(() =>
    tabParam === "documents" || tabParam === "onboarding" || tabParam === "leave"
      ? tabParam
      : "profile",
  );
  const [showLeaveLink, setShowLeaveLink] = useState(leaveLinkParam);

  useEffect(() => {
    if (
      tabParam === "profile" ||
      tabParam === "documents" ||
      tabParam === "onboarding" ||
      tabParam === "leave"
    ) {
      setTab(tabParam);
    }
    if (leaveLinkParam) setShowLeaveLink(true);
  }, [tabParam, leaveLinkParam]);

  const checklist = useMemo(
    () => getEmployeeSetupChecklist(employee, documents),
    [employee, documents],
  );
  const setupDone = isSetupChecklistComplete(checklist);
  const pendingSetup = checklist.filter((i) => !i.done).length;
  const onboardingOpen = onboarding.filter((i) => !i.is_done).length;
  const onboardingProgress = computeOnboardingProgress(onboarding);
  const balanceLines = useMemo(
    () =>
      buildLeaveBalanceLines({
        annual: {
          entitlement: leaveBalance.entitlementDays,
          taken: leaveBalance.takenDays,
        },
        caps: {
          mc: employee.leave_entitlements?.mc,
          emergency: employee.leave_entitlements?.emergency,
          hospitalisation: employee.leave_entitlements?.hospitalisation,
        },
        usedByType: countApprovedLeaveDaysByType(
          leaveRecords,
          leaveBalance.leaveYear,
        ),
      }),
    [employee.leave_entitlements, leaveBalance, leaveRecords],
  );

  const handleAddNow = useCallback((item: SetupChecklistItem) => {
    if (item.tab) setTab(item.tab);
    window.setTimeout(() => {
      const el = document.getElementById(item.scrollTarget);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
        el.focus();
      }
    }, 150);
  }, []);

  const scrollToEntitlement = useCallback(() => {
    setTab("profile");
    window.setTimeout(() => {
      document
        .getElementById("hr-field-al-entitlement")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("annual_leave_entitlement_days")?.focus();
    }, 150);
  }, []);

  const tabs = useMemo(() => {
    const items: { id: TabId; label: string; icon: typeof User; badge?: number }[] = [
      { id: "profile", label: "Profile", icon: User },
      {
        id: "documents",
        label: "Documents",
        icon: FileText,
        badge: pendingSetup > 0 ? checklist.filter((i) => !i.done && i.tab === "documents").length : undefined,
      },
      {
        id: "onboarding",
        label: "Onboarding",
        icon: ListChecks,
        badge: onboardingOpen > 0 ? onboardingOpen : undefined,
      },
      {
        id: "leave",
        label: "Leave",
        icon: Calendar,
        badge: leaveRecords.length > 0 ? leaveRecords.length : undefined,
      },
    ];
    return items;
  }, [checklist, leaveRecords.length, onboardingOpen, pendingSetup]);

  const contactMeta = [
    employee.phone_e164
      ? { icon: Phone, label: employee.phone_e164 }
      : null,
    employee.email ? { icon: Mail, label: employee.email } : null,
  ].filter(Boolean) as { icon: typeof Phone; label: string }[];

  return (
    <div className="space-y-6">
      <HrMobileSubnav />

      <Link
        href="/hr/employees"
        className={cn("inline-flex items-center gap-1.5 text-sm", hrClasses.link)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to employees
      </Link>

      {/* Hero */}
      <section
        className={cn(
          "relative mt-3 overflow-hidden rounded-2xl border p-4 shadow-sm sm:p-5",
          hrClasses.heroBorder,
          hrClasses.heroBg,
        )}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-teal-200/30 blur-2xl dark:bg-teal-800/20" />
        <div className="pointer-events-none absolute -bottom-8 -left-6 h-20 w-20 rounded-full bg-cream-200/50 blur-2xl dark:bg-teal-950/30" />

        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold uppercase shadow-sm",
                hrClasses.avatar,
              )}
            >
              {employee.full_name
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-xl font-bold tracking-tight text-ink dark:text-cream-100">
                  {employee.full_name}
                </h1>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                    statusChipClass(employee.status),
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      employee.status === "active"
                        ? "bg-[#0D9488]"
                        : employee.status === "terminated"
                          ? "bg-red-500"
                          : "bg-ink-subtle",
                    )}
                  />
                  {statusLabel(employee.status)}
                </span>
                {onboardingProgress.total > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab("onboarding")}
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ring-inset",
                      onboardingProgress.percent >= 100
                        ? "bg-teal-50 text-[#0F766E] ring-teal-200/80 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-800"
                        : "bg-cream-100 text-ink-muted ring-cream-200 dark:bg-hairline-dark dark:text-cream-300 dark:ring-hairline-dark",
                    )}
                  >
                    Onboarding {onboardingProgress.percent}%
                  </button>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
                {employee.employee_number ? (
                  <span className="font-medium text-ink-muted dark:text-cream-300">
                    {employee.employee_number}
                    <span className="mx-1.5 text-ink-subtle">·</span>
                  </span>
                ) : null}
                {employee.role_title} · {employmentLabel(employee.employment_type)}
              </p>
              <p className="mt-1 truncate text-[11px] text-ink-muted dark:text-cream-500">
                Joined {fmtJoined(employee.start_date)}
                {employee.contract_end_date
                  ? ` · Contract ends ${fmtJoined(employee.contract_end_date)}`
                  : null}
                {employee.base_salary_myr != null
                  ? ` · ${fmtSalaryMyr(employee.base_salary_myr)} / month`
                  : null}
                {contactMeta.length > 0
                  ? contactMeta.map(({ icon: Icon, label }) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 before:mx-1.5 before:content-['·']"
                      >
                        <Icon className="inline h-3 w-3 opacity-60" />
                        {label}
                      </span>
                    ))
                  : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
            <Link
              href={`/hr/leave/record?employee_id=${employee.id}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition active:scale-[0.98]",
                hrClasses.btnPrimary,
              )}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Record leave
            </Link>

            <button
              type="button"
              onClick={() => {
                setShowLeaveLink((v) => !v);
                setTab("leave");
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98]",
                showLeaveLink
                  ? "bg-teal-100 text-[#0F766E] dark:bg-teal-950/50 dark:text-teal-200"
                  : hrClasses.btnSecondary,
              )}
            >
              <Link2 className="h-3.5 w-3.5" />
              Leave link
            </button>
          </div>
        </div>

        <div className="relative mt-3">
          <HrLeaveBalanceStrip lines={balanceLines} />
          <button
            type="button"
            onClick={scrollToEntitlement}
            className={cn("mt-1.5 text-[10px] font-semibold", hrClasses.link)}
          >
            Set entitlements
          </button>
        </div>

        {!setupDone ? (
          <div className="relative mt-3">
            <HrSetupChecklist
              items={checklist}
              onAddNow={handleAddNow}
              welcome={welcome}
            />
          </div>
        ) : null}

        {showLeaveLink ? (
          <div className="relative mt-3 rounded-lg border border-cream-200/80 bg-white/90 p-3 dark:border-hairline-dark dark:bg-panel-dark/90">
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              Send leave request link (WhatsApp)
            </p>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Staff applies without logging in · expires in 24 hours
            </p>
            <div className="mt-2">
              <HrLeaveLinkActions
                employeeId={employee.id}
                employeeName={employee.full_name}
                employeePhone={employee.phone_e164}
                align="start"
              />
            </div>
          </div>
        ) : null}
      </section>

      {/* Tabs */}
      <nav
        className="mt-4 flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Employee sections"
      >
        {tabs.map(({ id, label, icon: Icon, badge }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                active
                  ? "bg-[#0D9488] text-white shadow-sm"
                  : "bg-cream-100 text-ink-muted hover:bg-cream-200 dark:bg-hairline-dark dark:text-cream-400 dark:hover:bg-hairline-dark/80",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-white text-[#0D9488] dark:bg-panel-dark dark:text-teal-400",
                  )}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-5 pb-16 lg:pb-6">
        {tab === "profile" ? (
          <div className="space-y-0">
            <div className="rounded-2xl border border-cream-200 bg-white p-5 sm:p-6 dark:border-hairline-dark dark:bg-panel-dark">
              <HrEmployeeUpdateForm employee={employee} />
            </div>
            <HrWarningLettersSection
              employeeId={employee.id}
              letters={warningLetters}
            />
          </div>
        ) : null}

        {tab === "documents" ? (
          <div
            id="hr-section-documents"
            className="space-y-5 rounded-2xl border border-cream-200 bg-white p-5 sm:p-6 dark:border-hairline-dark dark:bg-panel-dark"
          >
            <div>
              <h2 className={hrClasses.sectionTitle}>Staff documents</h2>
              <p className={cn("mt-1", hrClasses.sectionHint)}>
                IC and employment contract are required for payroll.
              </p>
            </div>
            <HrDocumentCreateForm
              employees={[employee]}
              defaultEmployeeId={employee.id}
              hideEmployeeSelect
            />
            {documents.length > 0 ? (
              <ul className="divide-y divide-cream-200 rounded-xl border border-cream-200 dark:divide-hairline-dark dark:border-hairline-dark">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                        {doc.label}
                      </p>
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        {documentTypeLabel(doc.document_type)}
                      </p>
                    </div>
                    {doc.admin_file_id ? (
                      <a
                        href={`/api/hr/documents/${doc.id}/download`}
                        className={cn("shrink-0 text-xs", hrClasses.link)}
                      >
                        Download
                      </a>
                    ) : (
                      <span className="shrink-0 text-xs text-amber-700 dark:text-amber-300">
                        Pending upload
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-cream-300 px-4 py-8 text-center text-sm text-ink-muted dark:border-hairline-dark dark:text-cream-400">
                No files yet — upload IC or contract above.
              </p>
            )}
          </div>
        ) : null}

        {tab === "onboarding" ? (
          <div className="rounded-2xl border border-cream-200 bg-white p-5 sm:p-6 dark:border-hairline-dark dark:bg-panel-dark">
            <div className="mb-4">
              <h2 className={hrClasses.sectionTitle}>Onboarding checklist</h2>
              <p className={cn("mt-1", hrClasses.sectionHint)}>
                Track first-day tasks beyond required documents.
              </p>
            </div>
            <HrOnboardingPanel employeeId={employee.id} items={onboarding} />
          </div>
        ) : null}

        {tab === "leave" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted dark:text-cream-400">
                {leaveRecords.length === 0
                  ? "No leave on file yet."
                  : `${leaveRecords.length} recent record${leaveRecords.length === 1 ? "" : "s"}`}
              </p>
              {leaveRecords.length > 0 ? (
                <Link
                  href={`/hr/leave/history?employee_id=${employee.id}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm font-semibold",
                    hrClasses.link,
                  )}
                >
                  <History className="h-4 w-4" />
                  Full history
                </Link>
              ) : null}
            </div>

            {leaveRecords.length > 0 ? (
              <div className="rounded-2xl border border-cream-200 bg-white px-4 dark:border-hairline-dark dark:bg-panel-dark">
                {leaveRecords.map((row) => (
                  <HrLeaveRecordRow
                    key={row.id}
                    row={row}
                    showStatus
                    hideEmployeeName
                    showManageActions
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-cream-300 px-4 py-10 text-center dark:border-hairline-dark">
                <p className="text-sm text-ink-muted dark:text-cream-400">
                  Record leave or send a WhatsApp link from above.
                </p>
                <Link
                  href={`/hr/leave/record?employee_id=${employee.id}`}
                  className={cn("mt-3 inline-flex text-sm font-semibold", hrClasses.link)}
                >
                  Record leave
                </Link>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
