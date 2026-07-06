import type { Role } from "@/lib/permissions";

const HR_CORE_MANAGERS = ["owner", "manager", "hr_officer"] as const;

export function canManageHrCore(role: Role): boolean {
  return (HR_CORE_MANAGERS as readonly string[]).includes(role);
}
