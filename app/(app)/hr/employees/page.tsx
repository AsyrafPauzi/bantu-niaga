import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Search,
  Users,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { HrDocumentCreateForm } from "@/components/hr/HrDocumentCreateForm";
import { HrEmployeeCreateForm } from "@/components/hr/HrEmployeeCreateForm";
import { HrLeaveLinkActions } from "@/components/hr/HrLeaveLinkActions";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { KpiTileBig } from "@/components/marketing/dashboard/KpiTileBig";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrDocuments, loadHrEmployees } from "@/lib/hr/load";

export const metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

export default async function EmployeesPage() {
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

  const [employees, documents] = await Promise.all([
    loadHrEmployees(user.businessId),
    loadHrDocuments(user.businessId),
  ]);
  const activeCount = employees.filter((employee) => employee.status === "active").length;
  const withEmergency = employees.filter(
    (employee) => employee.emergency_contact_name || employee.emergency_contact_phone,
  ).length;
  const withBank = employees.filter(
    (employee) => employee.bank_name || employee.bank_account_no,
  ).length;

  return (
    <div className="space-y-6">
      <Link
        href="/hr"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to HR
      </Link>

      <PageHeader
        eyebrow="HR"
        title="Employee registry"
        description="Store staff profiles, emergency contacts, bank details, and onboarding status."
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTileBig
          label="Total staff"
          value={String(employees.length)}
          sublabel="employee profiles"
          tone="brand"
        />
        <KpiTileBig
          label="Active"
          value={String(activeCount)}
          sublabel="currently working"
          tone="success"
        />
        <KpiTileBig
          label="Emergency"
          value={`${withEmergency}/${employees.length || 0}`}
          sublabel="contacts captured"
          tone="accent"
        />
        <KpiTileBig
          label="Documents"
          value={String(documents.length)}
          sublabel="linked HR files"
          tone="info"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-cream-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-hairline-dark">
            <div>
              <h2 className="text-base font-semibold text-ink dark:text-cream-100">
                Staff list
              </h2>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                {employees.length} employee records · {withBank} with bank details
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-cream-300 bg-cream-100 px-3 py-1.5 text-xs text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400">
              <Search className="h-3.5 w-3.5" />
              HR records
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-cream-100/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
                <tr>
                  <th className="px-5 py-3 text-left">Employee</th>
                  <th className="px-3 py-3 text-left">Type</th>
                  <th className="px-3 py-3 text-left">Start</th>
                  <th className="px-3 py-3 text-left">Emergency</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-left">Bank</th>
                  <th className="px-5 py-3 text-right">Leave link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
                {employees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-10 text-center text-sm text-ink-muted dark:text-cream-400"
                    >
                      No employees yet. Add your first staff profile.
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                            {employee.full_name.slice(0, 2)}
                          </span>
                          <div>
                            <p className="font-medium text-ink dark:text-cream-100">
                              {employee.full_name}
                            </p>
                            <p className="text-xs text-ink-muted dark:text-cream-400">
                              {employee.role_title}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-ink-muted dark:text-cream-400">
                        {employee.employment_type.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-3 text-ink-muted dark:text-cream-400">
                        {fmtDate(employee.start_date)}
                      </td>
                      <td className="px-3 py-3 text-ink-muted dark:text-cream-400">
                        {employee.emergency_contact_name ?? "Not set"}
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold uppercase text-ink-muted dark:text-cream-400">
                        {employee.status}
                      </td>
                      <td className="px-3 py-3 text-ink-muted dark:text-cream-400">
                        {employee.bank_name ?? "Not set"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <HrLeaveLinkActions
                          employeeId={employee.id}
                          employeeName={employee.full_name}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <SectionCard
          title="Add employee"
          subtitle="Core HR profile fields only. Payroll and contracts are add-ons."
          action={<Users className="h-4 w-4 text-brand-700 dark:text-brand-200" />}
        >
          <HrEmployeeCreateForm />
        </SectionCard>
      </div>

      <div id="documents" className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-cream-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-hairline-dark">
            <div>
              <h2 className="text-base font-semibold text-ink dark:text-cream-100">
                Staff document folder
              </h2>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                IC, passport, bank, medical, contract, and other staff document records.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
              <FileText className="h-3.5 w-3.5" />
              Admin Storage synced
            </span>
          </div>
          <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {documents.length === 0 ? (
              <p className="p-5 text-sm text-ink-muted dark:text-cream-400">
                No HR document records yet.
              </p>
            ) : (
              documents.map((document) => (
                <div key={document.id} className="flex items-start justify-between gap-3 p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-ink-muted dark:bg-hairline-dark dark:text-cream-400">
                        {document.document_type.replace(/_/g, " ")}
                      </span>
                      <p className="text-sm font-medium text-ink dark:text-cream-100">
                        {document.label}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                      {document.hr_employees?.full_name ?? "Employee"}
                    </p>
                  </div>
                  <span className="text-right text-xs text-ink-muted dark:text-cream-400">
                    {document.admin_files?.file_name ?? "Metadata only"}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <SectionCard
          title="Upload HR document"
          subtitle="Upload once here; it appears in Admin Storage automatically."
        >
          <HrDocumentCreateForm employees={employees} />
        </SectionCard>
      </div>
    </div>
  );
}
