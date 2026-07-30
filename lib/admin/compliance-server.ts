import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  complianceUrgency,
  daysUntil,
  type AdminComplianceRow,
} from "@/lib/admin/task-compliance-schemas";

const COMPLIANCE_SELECT =
  "id, business_id, title, category, authority, reference_number, " +
  "expires_on, remind_days, notes, status, last_renewed_at, admin_file_id, " +
  "created_at, updated_at";

export function enrichComplianceRow(row: AdminComplianceRow): AdminComplianceRow {
  return {
    ...row,
    days_until_expiry: daysUntil(row.expires_on),
    urgency: complianceUrgency(row.expires_on),
  };
}

export async function enrichComplianceRows(
  supabase: SupabaseClient,
  rows: AdminComplianceRow[],
): Promise<AdminComplianceRow[]> {
  const fileIds = Array.from(
    new Set(rows.map((r) => r.admin_file_id).filter(Boolean)),
  ) as string[];

  const fileNames = new Map<string, string>();
  if (fileIds.length > 0) {
    const { data } = await supabase
      .from("admin_files")
      .select("id, file_name")
      .in("id", fileIds)
      .is("deleted_at", null);
    for (const f of data ?? []) {
      fileNames.set(f.id as string, f.file_name as string);
    }
  }

  return rows.map((row) => ({
    ...enrichComplianceRow(row),
    admin_file_name: row.admin_file_id
      ? (fileNames.get(row.admin_file_id) ?? null)
      : null,
  }));
}

export async function logComplianceRenewal(
  supabase: SupabaseClient,
  input: {
    businessId: string;
    complianceItemId: string;
    previousExpiresOn: string;
    newExpiresOn: string;
    renewedBy: string;
    adminFileId?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("admin_compliance_renewal_events").insert({
    business_id: input.businessId,
    compliance_item_id: input.complianceItemId,
    previous_expires_on: input.previousExpiresOn,
    new_expires_on: input.newExpiresOn,
    renewed_by: input.renewedBy,
    admin_file_id: input.adminFileId ?? null,
  });
  if (error) throw new Error(error.message);
}

export { COMPLIANCE_SELECT };
