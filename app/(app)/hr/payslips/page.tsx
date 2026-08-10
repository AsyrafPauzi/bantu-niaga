import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { SectionCard } from "@/components/dashboard/section-card";
import { HrPayslipGenerateForm } from "@/components/hr/HrPayslipGenerateForm";
import { HrPayslipList } from "@/components/hr/HrPayslipList";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrEmployees } from "@/lib/hr/load";
import { listHrPayslips } from "@/lib/hr/payslips";

export const metadata = { title: "Payslips" };
export const dynamic = "force-dynamic";

export default async function HrPayslipsPage() {
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
          You do not have access to payslips.
        </CardBody>
      </Card>
    );
  }

  const [employees, payslips] = await Promise.all([
    loadHrEmployees(user.businessId),
    listHrPayslips(user.businessId),
  ]);

  const withSalary = employees.filter(
    (row) => row.status === "active" && row.base_salary_myr != null,
  ).length;

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Payslips"
          subtitle="Monthly payslips with Malaysia EPF, SOCSO, EIS & PCB (included in HR Core)"
          helpHref="/more"
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <SectionCard
            title="Generated payslips"
            subtitle={
              payslips.length === 0
                ? "No payslips yet"
                : `${payslips.length} on record`
            }
          >
            <HrPayslipList items={payslips} />
          </SectionCard>

          <SectionCard
            title="Generate payslip"
            subtitle={
              withSalary > 0
                ? `${withSalary} active staff with salary set`
                : "Set base salary on employee profiles first"
            }
          >
            <HrPayslipGenerateForm employees={employees} />
          </SectionCard>
        </div>
      </HrPageBody>
    </HrPageShell>
  );
}
