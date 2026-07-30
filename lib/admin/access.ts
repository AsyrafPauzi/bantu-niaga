import type { Role } from "@/lib/permissions";

/** Owner and manager — Admin AI is owner-facing back-office help. */
export function canUseAdminAssistant(role: Role): boolean {
  return role === "owner" || role === "manager";
}
