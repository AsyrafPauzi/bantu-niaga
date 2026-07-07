import { notFound, redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrShareLeavePanel } from "@/components/hr/HrShareLeavePanel";
import { HrBackLink } from "@/components/hr/layout/hr-back-link";
import { HrFormColumns } from "@/components/hr/layout/hr-form-columns";
import { HrInfoBanner } from "@/components/hr/layout/hr-info-banner";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrEmployee } from "@/lib/hr/load";

export const metadata = { title: "Share leave form" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ShareLeavePage({ params }: PageProps) {
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
          You do not have access to share leave forms.
        </CardBody>
      </Card>
    );
  }

  const employee = await loadHrEmployee(user.businessId, id);
  if (!employee) notFound();

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Share leave form"
          subtitle="Create a private link for staff to apply for leave"
          helpHref="/more"
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />
        <HrBackLink href="/hr/employees" label="Back to Employees" />

        <HrFormColumns
          form={
            <HrShareLeavePanel
              employeeId={employee.id}
              employeeName={employee.full_name}
              employeePhone={employee.phone_e164}
            />
          }
          help={
            <HrInfoBanner
              title="Private and secure"
              description="Each link is tied to one employee, expires in 24 hours, and can only be used once. Staff cannot change the name on the form."
            />
          }
        />
      </HrPageBody>
    </HrPageShell>
  );
}
