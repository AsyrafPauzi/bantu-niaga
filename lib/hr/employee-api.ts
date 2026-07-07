import "server-only";

import {
  EMPLOYEE_DETAIL_SELECT,
  EMPLOYEE_LIST_SELECT,
} from "@/lib/hr/employee-fields";
import type { HrEmployeeRow } from "@/lib/hr/load";
import { hydrateEmployeeSensitiveFields, sealEmployeeSensitiveFields } from "@/lib/hr/sensitive";

export { EMPLOYEE_DETAIL_SELECT, EMPLOYEE_LIST_SELECT };

export function mapEmployeeListRow(row: Record<string, unknown>): HrEmployeeRow {
  const { bank_account_no: _plain, ...rest } = row;
  return {
    ...(rest as unknown as HrEmployeeRow),
    bank_account_no: null,
    bank_account_no_sealed: row.bank_account_no_sealed ?? null,
  };
}

export function mapEmployeeDetailRow(
  row: Record<string, unknown>,
): HrEmployeeRow & {
  identity_type: string | null;
  identity_number: string | null;
  bank_account_no: string | null;
  identity_number_masked: string | null;
  bank_account_no_masked: string | null;
  annual_leave_entitlement_days: number;
} {
  const sensitive = hydrateEmployeeSensitiveFields({
    identity_number: row.identity_number as string | null,
    bank_account_no: row.bank_account_no as string | null,
    identity_number_sealed: row.identity_number_sealed as never,
    bank_account_no_sealed: row.bank_account_no_sealed as never,
  });

  return {
    ...(row as unknown as HrEmployeeRow),
    identity_type: (row.identity_type as string | null) ?? null,
    identity_number: sensitive.identity_number,
    bank_account_no: sensitive.bank_account_no,
    identity_number_masked: sensitive.identity_number_masked,
    bank_account_no_masked: sensitive.bank_account_no_masked,
    annual_leave_entitlement_days: Number(row.annual_leave_entitlement_days ?? 8),
  };
}

export function buildEmployeeWritePayload(
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  const {
    apply_default_onboarding: _onboarding,
    identity_number,
    bank_account_no,
    ...rest
  } = parsed;

  const payload: Record<string, unknown> = { ...rest };

  if (identity_number !== undefined || bank_account_no !== undefined) {
    const sealed = sealEmployeeSensitiveFields({
      identity_number: identity_number as string | null | undefined,
      bank_account_no: bank_account_no as string | null | undefined,
    });
    Object.assign(payload, sealed);
  }

  return payload;
}
