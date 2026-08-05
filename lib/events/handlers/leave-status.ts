import "server-only";

import { syncLeaveAvailabilityBlock } from "@/lib/hr/sync-leave-availability";
import type { HandlerContext } from "@/lib/events/dispatcher";
import type { LeaveStatusPayload } from "@/lib/events/payloads";

export async function handleLeaveStatus(ctx: HandlerContext): Promise<void> {
  const payload = ctx.payload as unknown as LeaveStatusPayload;
  await syncLeaveAvailabilityBlock(ctx.supabase, {
    businessId: payload.business_id,
    leaveId: payload.leave_id,
    employeeId: payload.employee_id,
    startDate: payload.start_date,
    endDate: payload.end_date,
    status: payload.status,
    reason: payload.reason ?? null,
  });
}
