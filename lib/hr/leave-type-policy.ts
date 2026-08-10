import { LEAVE_TYPES, type LeaveTypeKey } from "@/lib/hr/leave-labels";

export interface LeaveTypePolicyRow {
  leave_type: LeaveTypeKey;
  enabled: boolean;
  attachment_required: boolean;
}

/** Leave types that are enabled for apply/create forms. */
export function enabledLeaveTypeKeys(
  settings: readonly LeaveTypePolicyRow[],
): LeaveTypeKey[] {
  const enabled = new Set(
    settings.filter((s) => s.enabled).map((s) => s.leave_type),
  );
  const keys = LEAVE_TYPES.map((t) => t.key).filter((k) => enabled.has(k));
  return keys.length > 0 ? keys : LEAVE_TYPES.map((t) => t.key);
}

export function isLeaveTypeEnabled(
  leaveType: string,
  settings: readonly LeaveTypePolicyRow[],
): boolean {
  const row = settings.find((s) => s.leave_type === leaveType);
  if (row) return row.enabled;
  return LEAVE_TYPES.some((t) => t.key === leaveType);
}

export function filterLeaveTypesByEnabled<T extends { key: LeaveTypeKey }>(
  types: readonly T[],
  enabledKeys: readonly LeaveTypeKey[],
): T[] {
  const set = new Set(enabledKeys);
  const filtered = types.filter((t) => set.has(t.key));
  return filtered.length > 0 ? filtered : [...types];
}
