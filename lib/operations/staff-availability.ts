import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface StaffLeaveConflict {
  employeeId: string;
  employeeName: string;
  startsOn: string;
  endsOn: string;
  reason: string | null;
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Returns leave blocks that overlap a proposed booking when the resource
 * is linked to an HR employee.
 */
export async function findStaffLeaveConflicts(
  supabase: SupabaseClient,
  businessId: string,
  input: { resourceId: string; startsAt: string; endsAt: string },
): Promise<StaffLeaveConflict[]> {
  const { data: resource } = await supabase
    .from("operations_booking_resources")
    .select("employee_id")
    .eq("id", input.resourceId)
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .maybeSingle();

  const employeeId = resource?.employee_id as string | null | undefined;
  if (!employeeId) return [];

  const startOn = dateOnly(input.startsAt);
  const endOn = dateOnly(input.endsAt);

  const { data: blocks } = await supabase
    .from("operations_staff_availability_blocks")
    .select(
      "starts_on, ends_on, reason, employee:hr_employees!inner(id, full_name)",
    )
    .eq("business_id", businessId)
    .eq("employee_id", employeeId)
    .lte("starts_on", endOn)
    .gte("ends_on", startOn);

  return (blocks ?? []).map((row) => {
    const emp = Array.isArray(row.employee) ? row.employee[0] : row.employee;
    return {
      employeeId,
      employeeName: (emp as { full_name?: string } | null)?.full_name ?? "Staff",
      startsOn: row.starts_on as string,
      endsOn: row.ends_on as string,
      reason: (row.reason as string | null) ?? null,
    };
  });
}
