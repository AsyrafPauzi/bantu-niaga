import { SectionCard } from "@/components/dashboard/section-card";
import { HrPayslipList } from "@/components/hr/HrPayslipList";
import { MeMobileSubnav } from "@/components/hr/me/MeMobileSubnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { listHrPayslips } from "@/lib/hr/payslips";
import { resolveStaffMePage } from "@/lib/hr/staff-self-service";

export const metadata = { title: "My payslips" };
export const dynamic = "force-dynamic";

export default async function HrMePayslipsPage() {
  const ctx = await resolveStaffMePage();
  if (!ctx) return null;

  const { user, employee } = ctx;
  const payslips = await listHrPayslips(user.businessId, {
    employeeId: employee.id,
  });

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="My payslips"
          subtitle={`${employee.full_name} · simple payslips from base salary`}
        />
      }
    >
      <HrPageBody>
        <MeMobileSubnav pathname="/hr/me/payslips" />

        <SectionCard
          title="Simple payslips"
          subtitle={
            payslips.length === 0
              ? "No payslips published yet"
              : `${payslips.length} available to download`
          }
          bodyClassName="pt-0"
        >
          <p className="mb-4 text-xs text-ink-muted dark:text-cream-400">
            These are simple payslips based on your recorded base salary. They
            are not statutory payroll documents.
          </p>
          <HrPayslipList items={payslips} showEmployee={false} />
        </SectionCard>
      </HrPageBody>
    </HrPageShell>
  );
}
