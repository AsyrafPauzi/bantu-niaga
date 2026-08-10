import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { LEAVE_TYPES, type LeaveTypeKey } from "@/lib/hr/leave-labels";
export {
  enabledLeaveTypeKeys,
  isLeaveTypeEnabled,
  filterLeaveTypesByEnabled,
} from "@/lib/hr/leave-type-policy";

export interface HrLeaveTypeSettingRow {
  leave_type: LeaveTypeKey;
  default_quota_days: number | null;
  attachment_required: boolean;
  enabled: boolean;
}

export const DEFAULT_LEAVE_TYPE_SETTINGS: readonly HrLeaveTypeSettingRow[] = [
  {
    leave_type: "annual",
    default_quota_days: 8,
    attachment_required: false,
    enabled: true,
  },
  {
    leave_type: "emergency",
    default_quota_days: null,
    attachment_required: true,
    enabled: true,
  },
  {
    leave_type: "mc",
    default_quota_days: 14,
    attachment_required: true,
    enabled: true,
  },
  {
    leave_type: "hospitalisation",
    default_quota_days: 60,
    attachment_required: true,
    enabled: true,
  },
  {
    leave_type: "unpaid",
    default_quota_days: null,
    attachment_required: false,
    enabled: true,
  },
] as const;

export async function loadHrLeaveTypeSettings(
  supabase: SupabaseClient,
  businessId: string,
): Promise<HrLeaveTypeSettingRow[]> {
  const { data } = await supabase
    .from("hr_leave_type_settings")
    .select("leave_type, default_quota_days, attachment_required, enabled")
    .eq("business_id", businessId);

  const map = new Map<string, HrLeaveTypeSettingRow>();
  for (const row of data ?? []) {
    const lt = row.leave_type as string;
    if (!LEAVE_TYPES.some((t) => t.key === lt)) continue;
    map.set(lt, {
      leave_type: lt as LeaveTypeKey,
      default_quota_days:
        row.default_quota_days != null ? Number(row.default_quota_days) : null,
      attachment_required: Boolean(row.attachment_required),
      enabled: Boolean(row.enabled),
    });
  }

  return DEFAULT_LEAVE_TYPE_SETTINGS.map((def) => map.get(def.leave_type) ?? { ...def });
}

export function leaveTypeRequiresAttachment(
  leaveType: string,
  settings: readonly HrLeaveTypeSettingRow[],
): boolean {
  const row = settings.find((s) => s.leave_type === leaveType);
  if (row) return row.attachment_required;
  return leaveType === "mc" || leaveType === "emergency" || leaveType === "hospitalisation";
}

export function defaultQuotaForLeaveType(
  leaveType: string,
  settings: readonly HrLeaveTypeSettingRow[],
): number | null {
  const row = settings.find((s) => s.leave_type === leaveType);
  if (row) return row.default_quota_days;
  if (leaveType === "annual") return 8;
  if (leaveType === "mc") return 14;
  return null;
}

export type EmployeeLeaveEntitlements = Partial<Record<LeaveTypeKey, number>>;

export function employeeEntitlementDays(
  leaveType: LeaveTypeKey,
  employee: {
    annual_leave_entitlement_days?: number | null;
    leave_entitlements?: unknown;
  },
  settings: readonly HrLeaveTypeSettingRow[],
): number | null {
  if (leaveType === "annual") {
    return employee.annual_leave_entitlement_days != null
      ? Number(employee.annual_leave_entitlement_days)
      : defaultQuotaForLeaveType("annual", settings);
  }
  if (leaveType === "unpaid") return null;
  const overrides = parseEmployeeLeaveEntitlements(employee.leave_entitlements);
  if (overrides[leaveType] != null) return overrides[leaveType]!;
  return defaultQuotaForLeaveType(leaveType, settings);
}

export function attachmentRequiredMap(
  settings: readonly HrLeaveTypeSettingRow[],
): Record<LeaveTypeKey, boolean> {
  const map = {} as Record<LeaveTypeKey, boolean>;
  for (const row of settings) {
    map[row.leave_type] = row.attachment_required;
  }
  for (const type of LEAVE_TYPES) {
    if (map[type.key] === undefined) {
      map[type.key] = leaveTypeRequiresAttachment(type.key, settings);
    }
  }
  return map;
}

export function parseEmployeeLeaveEntitlements(
  raw: unknown,
): EmployeeLeaveEntitlements {
  if (!raw || typeof raw !== "object") return {};
  const out: EmployeeLeaveEntitlements = {};
  for (const type of LEAVE_TYPES) {
    const v = (raw as Record<string, unknown>)[type.key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[type.key] = v;
    }
  }
  return out;
}
