import type { Role } from "@/lib/permissions";
import { hasFullAccess } from "@/lib/permissions";

/** Owner, manager, and marketing_officer can use Marketing core + Maya. */
export function canManageMarketingCore(role: Role): boolean {
  return hasFullAccess(role, "marketing");
}
