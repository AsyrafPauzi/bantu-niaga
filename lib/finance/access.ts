import type { Role } from "@/lib/permissions";

/** Owner and manager only — Finance AI is owner-facing, not accountant. */
export function canUseFinanceAssistant(role: Role): boolean {
  return role === "owner" || role === "manager";
}
