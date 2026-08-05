import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Create or remove Operations availability blocks when leave status changes. */
export async function syncLeaveAvailabilityBlock(
  supabase: SupabaseClient,
  opts: {
    businessId: string;
    leaveId: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    status: string;
    reason?: string | null;
  },
): Promise<void> {
  if (opts.status === "approved") {
    await supabase
      .from("operations_staff_availability_blocks")
      .delete()
      .eq("business_id", opts.businessId)
      .eq("leave_record_id", opts.leaveId);

    await supabase.from("operations_staff_availability_blocks").insert({
      business_id: opts.businessId,
      employee_id: opts.employeeId,
      leave_record_id: opts.leaveId,
      starts_on: opts.startDate,
      ends_on: opts.endDate,
      reason: opts.reason ?? "Approved leave",
    });
    return;
  }

  await supabase
    .from("operations_staff_availability_blocks")
    .delete()
    .eq("business_id", opts.businessId)
    .eq("leave_record_id", opts.leaveId);
}
