import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { SectionCard } from "@/components/dashboard/section-card";
import { HrDocumentCreateForm } from "@/components/hr/HrDocumentCreateForm";
import { HrEmployeeUpdateForm } from "@/components/hr/HrEmployeeUpdateForm";
import { HrLeaveBalanceBadge } from "@/components/hr/HrLeaveBalanceBadge";
import { HrOnboardingPanel } from "@/components/hr/HrOnboardingPanel";
import { HrBackLink } from "@/components/hr/layout/hr-back-link";
import { HrFormColumns } from "@/components/hr/layout/hr-form-columns";
import { HrInfoBanner } from "@/components/hr/layout/hr-info-banner";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrDocuments, loadHrEmployee, loadHrEmployeeLeaveBalanceSummary, loadHrOnboardingItems } from "@/lib/hr/load";
import { formatOnboardingProgress, computeOnboardingProgress } from "@/lib/hr/onboarding-progress";
import {
  describeProfileGaps,
  getProfileCompletionGaps,
  isEmployeeProfileIncomplete,
} from "@/lib/hr/profile-completion";

export const metadata = { title: "Employee" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

function employmentLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function EmployeeDetailPage({ params }: PageProps) {
  const { id } = await params;

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
          You do not have access to employee records.
        </CardBody>
      </Card>
    );
  }

  const employee = await loadHrEmployee(user.businessId, id);
  if (!employee) notFound();

  const [documents, onboardingItems, leaveBalance] = await Promise.all([
    loadHrDocuments(user.businessId),
    loadHrOnboardingItems(user.businessId),
    loadHrEmployeeLeaveBalanceSummary(
      user.businessId,
      id,
      employee.annual_leave_entitlement_days ?? 8,
    ),
  ]);
  const employeeDocuments = documents.filter((d) => d.employee_id === employee.id);
  const employeeOnboarding = onboardingItems.filter((item) => item.employee_id === employee.id);
  const onboardingProgress = computeOnboardingProgress(employeeOnboarding);
  const profileIncomplete = isEmployeeProfileIncomplete(employee, employeeDocuments);
  const profileGaps = getProfileCompletionGaps(employee, employeeDocuments);

  const statusChip =
    employee.status === "active"
      ? "bg-[#E6F3EC] text-[#0F7B4A]"
      : employee.status === "terminated"
        ? "bg-cream-100 text-ink-muted"
        : "bg-cream-100 text-ink-muted";

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title={employee.full_name}
          subtitle={`${employee.role_title} · ${employmentLabel(employee.employment_type)} · Started ${fmtDate(employee.start_date)}`}
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />
        <HrBackLink href="/hr/employees" label="Back to Employees" />

        {profileIncomplete ? (
          <HrInfoBanner
            title="Profile incomplete"
            description={`Still needed: ${describeProfileGaps(profileGaps)}. Compulsory documents: IC, bank details, and employment contract.`}
          />
        ) : null}

        <div className="flex flex-col gap-5 rounded-2xl border border-[#E5E0D8] bg-white p-6 sm:flex-row sm:items-center dark:border-hairline-dark dark:bg-panel-dark">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-bold uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
            {employee.full_name.slice(0, 2)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-ink dark:text-cream-100">
              {employee.full_name}
            </p>
            <p className="text-sm text-ink-muted dark:text-cream-400">
              {employee.role_title} · {employmentLabel(employee.employment_type)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/hr/employees/${employee.id}/share-leave`}
              className="rounded-[10px] border border-[#E5E0D8] px-3 py-2 text-xs font-semibold text-brand-700 dark:border-hairline-dark dark:text-brand-200"
            >
              Share leave form
            </Link>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusChip}`}
            >
              {employee.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        <HrLeaveBalanceBadge balance={leaveBalance} />

        <HrFormColumns
          form={
            <div className="space-y-6">
              <SectionCard title="Profile details" subtitle="Update contact and bank information">
                <HrEmployeeUpdateForm employee={employee} />
              </SectionCard>
              <SectionCard
                title="Onboarding checklist"
                subtitle={formatOnboardingProgress(onboardingProgress)}
              >
                <HrOnboardingPanel employeeId={employee.id} items={employeeOnboarding} />
              </SectionCard>
            </div>
          }
          help={
            <SectionCard title="HR documents" subtitle="Linked files from Admin Storage">
              <HrDocumentCreateForm employees={[employee]} />
              <div className="mt-4 divide-y divide-cream-200 dark:divide-hairline-dark">
                {employeeDocuments.length === 0 ? (
                  <p className="py-3 text-sm text-ink-muted dark:text-cream-400">
                    No documents linked yet.
                  </p>
                ) : (
                  employeeDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-ink dark:text-cream-100">
                          {doc.label}
                        </p>
                        <p className="text-xs text-ink-muted dark:text-cream-400">
                          {doc.document_type.replace(/_/g, " ")}
                        </p>
                      </div>
                      {doc.admin_file_id ? (
                        <a
                          href={`/api/hr/documents/${doc.id}/download`}
                          className="shrink-0 text-xs font-semibold text-brand-700 dark:text-brand-200"
                        >
                          Download
                        </a>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          }
        />
      </HrPageBody>
    </HrPageShell>
  );
}
