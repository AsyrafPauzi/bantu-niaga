import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrLeaveHistoryView } from "@/components/hr/HrLeaveHistoryView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrEmployee, loadHrLeaveRecords } from "@/lib/hr/load";

export const metadata = { title: "Leave history" };
export const dynamic = "force-dynamic";

export default async function LeaveHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ employee_id?: string }>;
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
          You do not have access to leave records.
        </CardBody>
      </Card>
    );
  }

  const { employee_id: employeeId } = await searchParams;
  const [leave, employee] = await Promise.all([
    loadHrLeaveRecords(user.businessId),
    employeeId ? loadHrEmployee(user.businessId, employeeId) : Promise.resolve(null),
  ]);

  const filtered = employeeId
    ? leave.filter((row) => row.employee_id === employeeId)
    : leave;

  return <HrLeaveHistoryView leave={filtered} employee={employee} />;
}
