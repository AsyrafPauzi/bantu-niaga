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
import { loadHrWarningLetters } from "@/lib/hr/warning-letters";
import { loadTeamMembers } from "@/lib/settings/team";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const [allDocuments, onboardingItems, leaveBalance, allLeave, warningLetters, teamMembers, linkedRows] =
    await Promise.all([
      loadHrDocuments(user.businessId),
      loadHrOnboardingItems(user.businessId),
      loadHrEmployeeLeaveBalanceSummary(
        user.businessId,
        id,
        employee.annual_leave_entitlement_days ?? 8,
      ),
      loadHrLeaveRecords(user.businessId),
      loadHrWarningLetters(user.businessId, id),
      loadTeamMembers(user.businessId),
      (async () => {
        const supabase = await createSupabaseServerClient();
        const { data } = await supabase
          .from("hr_employees")
          .select("id, user_id")
          .eq("business_id", user.businessId)
          .not("user_id", "is", null);
        return data ?? [];
      })(),
    ]);

  const employeeDocuments = allDocuments.filter((d) => d.employee_id === employee.id);
  const employeeOnboarding = onboardingItems.filter((item) => item.employee_id === employee.id);
  const employeeLeave = allLeave
    .filter((row) => row.employee_id === employee.id)
    .slice(0, 8);

  const takenUserIds = linkedRows
    .filter((r) => r.user_id && r.id !== employee.id)
    .map((r) => r.user_id as string);

  return (
    <Suspense fallback={null}>
      <HrEmployeeProfileView
        employee={employee}
        documents={employeeDocuments}
        onboarding={employeeOnboarding}
        leaveBalance={leaveBalance}
        leaveRecords={employeeLeave}
        warningLetters={warningLetters}
        teamMembers={teamMembers.map((m) => ({
          id: m.id,
          email: m.email,
          display_name: m.display_name,
          role: m.role,
        }))}
        takenUserIds={takenUserIds}
      />
    </Suspense>
  );
}
