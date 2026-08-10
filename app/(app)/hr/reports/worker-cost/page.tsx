import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { SectionCard } from "@/components/dashboard/section-card";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { formatMyr } from "@/lib/finance/schemas";
import { loadWorkerCostReport } from "@/lib/hr/worker-cost";

export const metadata = { title: "Worker cost report" };
export const dynamic = "force-dynamic";

const inputClass =
  "rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

function defaultMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function employmentLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function HrWorkerCostReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
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
          You do not have access to HR reports.
        </CardBody>
      </Card>
    );
  }

  const params = await searchParams;
  const monthParam = params.month ?? defaultMonth();
  let month = defaultMonth();
  let report;
  try {
    month = monthParam;
    report = await loadWorkerCostReport(user.businessId, month);
  } catch {
    report = await loadWorkerCostReport(user.businessId, defaultMonth());
    month = defaultMonth();
  }
  const csvHref = `/api/hr/reports/worker-cost?month=${encodeURIComponent(month)}&format=csv`;

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Worker cost report"
          subtitle="Estimated monthly payroll from active staff base salaries"
          helpHref="/more"
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />

        <SectionCard
          title={report.period_label}
          subtitle={`${report.employees_with_salary} with salary · ${report.employees_without_salary} without`}
          action={
            <Link
              href={csvHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-cream-50 dark:border-hairline-dark dark:text-brand-200 dark:hover:bg-panel-dark"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              Export CSV
            </Link>
          }
        >
          <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="month"
                className="text-xs font-semibold text-ink-muted dark:text-cream-400"
              >
                Month
              </label>
              <input
                id="month"
                type="month"
                name="month"
                defaultValue={month}
                className={`${inputClass} mt-1`}
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Apply
            </button>
          </form>

          <p className="mb-4 text-xs text-ink-muted dark:text-cream-400">
            Estimates use each employee&apos;s base salary only. Not statutory
            payroll or employer contributions.
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-xs font-semibold uppercase tracking-wide text-ink-muted dark:border-hairline-dark dark:text-cream-400">
                  <th className="px-2 py-2">Employee</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2 text-right">Base salary</th>
                  <th className="px-2 py-2 text-right">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-2 py-6 text-center text-ink-muted dark:text-cream-400"
                    >
                      No active employees.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row) => (
                    <tr
                      key={row.employee_id}
                      className="border-b border-cream-100 dark:border-hairline-dark/60"
                    >
                      <td className="px-2 py-2.5 font-medium text-ink dark:text-cream-100">
                        {row.full_name}
                      </td>
                      <td className="px-2 py-2.5 text-ink-muted dark:text-cream-400">
                        {row.role_title}
                      </td>
                      <td className="px-2 py-2.5 text-ink-muted dark:text-cream-400">
                        {employmentLabel(row.employment_type)}
                      </td>
                      <td className="px-2 py-2.5 text-right text-ink dark:text-cream-100">
                        {row.base_salary_myr != null
                          ? formatMyr(row.base_salary_myr)
                          : "—"}
                      </td>
                      <td className="px-2 py-2.5 text-right font-medium text-ink dark:text-cream-100">
                        {formatMyr(row.estimated_cost_myr)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {report.rows.length > 0 ? (
                <tfoot>
                  <tr>
                    <td
                      colSpan={4}
                      className="px-2 pt-4 text-right text-sm font-semibold text-ink dark:text-cream-100"
                    >
                      Total estimated cost
                    </td>
                    <td className="px-2 pt-4 text-right text-sm font-bold text-ink dark:text-cream-100">
                      {formatMyr(report.total_estimated_cost_myr)}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </SectionCard>
      </HrPageBody>
    </HrPageShell>
  );
}
