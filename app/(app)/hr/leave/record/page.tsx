import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrLeaveRecordView } from "@/components/hr/HrLeaveRecordView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrEmployees } from "@/lib/hr/load";
import {
  attachmentRequiredMap,
  enabledLeaveTypeKeys,
  loadHrLeaveTypeSettings,
} from "@/lib/hr/leave-type-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Record leave" };
export const dynamic = "force-dynamic";

export default async function RecordLeavePage({
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
          You do not have access to record leave.
        </CardBody>
      </Card>
    );
  }

  const { employee_id: defaultEmployeeId } = await searchParams;
  const employees = await loadHrEmployees(user.businessId);
  const supabase = await createSupabaseServerClient();
  const leaveSettings = await loadHrLeaveTypeSettings(supabase, user.businessId);
  const attachmentRequired = attachmentRequiredMap(leaveSettings);
  const enabledLeaveTypes = enabledLeaveTypeKeys(leaveSettings);

  return (
    <HrLeaveRecordView
      employees={employees}
      defaultEmployeeId={defaultEmployeeId}
      attachmentRequired={attachmentRequired}
      enabledLeaveTypes={enabledLeaveTypes}
    />
  );
}
