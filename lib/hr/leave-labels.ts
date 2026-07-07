import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CalendarDays, Stethoscope } from "lucide-react";

export type LeaveTypeKey = "annual" | "emergency" | "mc";

export interface LeaveTypeMeta {
  key: LeaveTypeKey;
  short: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: "brand" | "accent" | "warning";
}

export const LEAVE_TYPES: readonly LeaveTypeMeta[] = [
  {
    key: "annual",
    short: "AL",
    label: "Annual leave",
    description: "Planned time off — holidays, family trips, personal days.",
    icon: CalendarDays,
    tone: "brand",
  },
  {
    key: "emergency",
    short: "EL",
    label: "Emergency leave",
    description: "Urgent personal matters that cannot wait.",
    icon: AlertTriangle,
    tone: "accent",
  },
  {
    key: "mc",
    short: "MC",
    label: "Medical leave (MC)",
    description: "Sick leave with a medical certificate or doctor's note.",
    icon: Stethoscope,
    tone: "warning",
  },
] as const;

export function getLeaveTypeMeta(type: string): LeaveTypeMeta | undefined {
  return LEAVE_TYPES.find((item) => item.key === type);
}

export function leaveTypeShort(type: string): string {
  return getLeaveTypeMeta(type)?.short ?? type.toUpperCase();
}

export function leaveTypeLabel(type: string): string {
  return getLeaveTypeMeta(type)?.label ?? type.replace(/_/g, " ");
}

const BADGE_CLASS: Record<LeaveTypeMeta["tone"], string> = {
  brand:
    "bg-[#EEF3FE] text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  accent:
    "bg-[#FFF7ED] text-[#C2410C] dark:bg-accent-900/30 dark:text-accent-300",
  warning:
    "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
};

export function leaveTypeBadgeClass(type: string): string {
  const meta = getLeaveTypeMeta(type);
  return meta ? BADGE_CLASS[meta.tone] : BADGE_CLASS.brand;
}
