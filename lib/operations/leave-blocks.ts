import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface OperationsLeaveBlockRow {
  id: string;
  employee_id: string;
  employee_name: string;
  starts_on: string;
  ends_on: string;
  reason: string | null;
}

export async function loadActiveLeaveBlocks(
  supabase: SupabaseClient,
  businessId: string,
): Promise<OperationsLeaveBlockRow[]> {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());

  const { data } = await supabase
    .from("operations_staff_availability_blocks")
    .select(
      "id, employee_id, starts_on, ends_on, reason, employee:hr_employees!inner(full_name)",
    )
    .eq("business_id", businessId)
    .gte("ends_on", today)
    .order("starts_on", { ascending: true });

  return (data ?? []).map((row) => {
    const emp = Array.isArray(row.employee) ? row.employee[0] : row.employee;
    return {
      id: row.id as string,
      employee_id: row.employee_id as string,
      employee_name:
        (emp as { full_name?: string } | null)?.full_name ?? "Staff",
      starts_on: row.starts_on as string,
      ends_on: row.ends_on as string,
      reason: (row.reason as string | null) ?? null,
    };
  });
}
