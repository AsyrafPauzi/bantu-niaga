import type { SupabaseClient } from "@supabase/supabase-js";

export async function nextEmployeeNumber(
  admin: SupabaseClient,
  businessId: string,
  prefix = "EMP",
): Promise<string> {
  const pattern = `${prefix}-`;
  const { data } = await admin
    .from("hr_employees")
    .select("employee_number")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .like("employee_number", `${pattern}%`)
    .order("employee_number", { ascending: false })
    .limit(1);

  const last = (data?.[0] as { employee_number: string } | undefined)?.employee_number;
  let seq = 1;
  if (last?.startsWith(pattern)) {
    const tail = parseInt(last.slice(pattern.length), 10);
    if (Number.isFinite(tail)) seq = tail + 1;
  }
  return `${pattern}${String(seq).padStart(3, "0")}`;
}

export async function isEmployeeNumberTaken(
  admin: SupabaseClient,
  businessId: string,
  employeeNumber: string,
  excludeEmployeeId?: string,
): Promise<boolean> {
  let query = admin
    .from("hr_employees")
    .select("id")
    .eq("business_id", businessId)
    .eq("employee_number", employeeNumber)
    .is("deleted_at", null);

  if (excludeEmployeeId) {
    query = query.neq("id", excludeEmployeeId);
  }

  const { data } = await query.maybeSingle();
  return data != null;
}
