import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrEmployeeCreateWizard } from "@/components/hr/HrEmployeeCreateWizard";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";

export const metadata = { title: "Add employee" };
export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
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
          You do not have access to add employees.
        </CardBody>
      </Card>
    );
  }

  return <HrEmployeeCreateWizard />;
}
