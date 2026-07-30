import { can, canSurface, type Role } from "@/lib/permissions";
import { canUseLeads } from "@/lib/sales/access";

/** Roles that may list or download admin_files for cross-pillar attach (not upload). */
export function canUseAdminFilePicker(role: Role): boolean {
  return (
    canSurface(role, "admin", "storage") ||
    can(role, "finance") ||
    can(role, "operations") ||
    canUseLeads(role)
  );
}
