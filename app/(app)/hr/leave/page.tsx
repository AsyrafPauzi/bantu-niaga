import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrLeaveView } from "@/components/hr/HrLeaveView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrLeaveRecords } from "@/lib/hr/load";

export const metadata = { title: "Leave" };
export const dynamic = "force-dynamic";

export default async function LeavePage() {
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

  const leave = await loadHrLeaveRecords(user.businessId);

  return <HrLeaveView leave={leave} />;
}
