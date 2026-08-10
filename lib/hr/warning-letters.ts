import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  HrWarningLetterRow,
  WarningLetterSeverity,
} from "@/lib/hr/warning-letters-shared";

export type { HrWarningLetterRow, WarningLetterSeverity };
export { WARNING_LETTER_SEVERITIES } from "@/lib/hr/warning-letters-shared";

const WARNING_LETTER_SELECT =
  "id, employee_id, issued_at, reason, severity, admin_file_id, issued_by, created_at";

export async function loadHrWarningLetters(
  businessId: string,
  employeeId?: string,
): Promise<HrWarningLetterRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("hr_warning_letters")
    .select(WARNING_LETTER_SELECT)
    .eq("business_id", businessId)
    .order("issued_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HrWarningLetterRow[];
}

export async function createHrWarningLetter(
  admin: SupabaseClient,
  input: {
    businessId: string;
    employeeId: string;
    issuedAt: string;
    reason: string;
    severity: WarningLetterSeverity;
    adminFileId?: string | null;
    issuedBy?: string | null;
  },
): Promise<HrWarningLetterRow> {
  const { data, error } = await admin
    .from("hr_warning_letters")
    .insert({
      business_id: input.businessId,
      employee_id: input.employeeId,
      issued_at: input.issuedAt,
      reason: input.reason,
      severity: input.severity,
      admin_file_id: input.adminFileId ?? null,
      issued_by: input.issuedBy ?? null,
    })
    .select(WARNING_LETTER_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as HrWarningLetterRow;
}
