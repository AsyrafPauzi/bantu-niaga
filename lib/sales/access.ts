import type { Role } from "@/lib/permissions";
import { canSurface, hasFullAccess } from "@/lib/permissions";

/** Owner, manager, cashier can run POS; sales_rep can view POS. */
export function canUsePos(role: Role): boolean {
  return hasFullAccess(role, "sales") || canSurface(role, "sales", "pos");
}

export function canManageSalesCore(role: Role): boolean {
  return hasFullAccess(role, "sales") || role === "cashier" || role === "sales_rep";
}

/** Owner, manager, sales_rep — not cashier. */
export function canUseLeads(role: Role): boolean {
  return hasFullAccess(role, "sales") || canSurface(role, "sales", "leads");
}

/** Roles that may be assigned a lead. */
export const LEAD_ASSIGNEE_ROLES: Role[] = ["owner", "manager", "sales_rep"];

export function isLeadAssigneeRole(role: string): boolean {
  return (LEAD_ASSIGNEE_ROLES as string[]).includes(role);
}
