import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrEmployeesView } from "@/components/hr/HrEmployeesView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import {
  loadHrDocuments,
  loadHrEmployees,
  loadHrOnboardingItems,
} from "@/lib/hr/load";
import { onboardingProgressByEmployeeId } from "@/lib/hr/onboarding-progress";

export const metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

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

  const [employees, documents, onboardingItems] = await Promise.all([
    loadHrEmployees(user.businessId),
    loadHrDocuments(user.businessId),
    loadHrOnboardingItems(user.businessId),
  ]);

  const progressMap = onboardingProgressByEmployeeId(onboardingItems);
  const onboardingPercentByEmployeeId: Record<string, number> = {};
  for (const [id, progress] of progressMap) {
    if (progress.total > 0) {
      onboardingPercentByEmployeeId[id] = progress.percent;
    }
  }

  return (
    <HrEmployeesView
      employees={employees}
      documents={documents}
      onboardingPercentByEmployeeId={onboardingPercentByEmployeeId}
    />
  );
}
