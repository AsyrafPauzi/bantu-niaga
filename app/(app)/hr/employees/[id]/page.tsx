import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrEmployeeProfileView } from "@/components/hr/HrEmployeeProfileView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import {
  loadHrDocuments,
  loadHrEmployee,
  loadHrEmployeeLeaveBalanceSummary,
  loadHrLeaveRecords,
  loadHrOnboardingItems,
} from "@/lib/hr/load";

export const metadata = { title: "Employee" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
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

  const [allDocuments, onboardingItems, leaveBalance, allLeave] = await Promise.all([
    loadHrDocuments(user.businessId),
    loadHrOnboardingItems(user.businessId),
    loadHrEmployeeLeaveBalanceSummary(
      user.businessId,
      id,
      employee.annual_leave_entitlement_days ?? 8,
    ),
    loadHrLeaveRecords(user.businessId),
  ]);

  const employeeDocuments = allDocuments.filter((d) => d.employee_id === employee.id);
  const employeeOnboarding = onboardingItems.filter((item) => item.employee_id === employee.id);
  const employeeLeave = allLeave
    .filter((row) => row.employee_id === employee.id)
    .slice(0, 8);

  return (
    <Suspense fallback={null}>
      <HrEmployeeProfileView
        employee={employee}
        documents={employeeDocuments}
        onboarding={employeeOnboarding}
        leaveBalance={leaveBalance}
        leaveRecords={employeeLeave}
      />
    </Suspense>
  );
}
