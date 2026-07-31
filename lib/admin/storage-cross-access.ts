import type { AdminFileCategory } from "@/lib/admin/schemas";
import { can, canSurface, type Role } from "@/lib/permissions";
import { canUseLeads } from "@/lib/sales/access";

/** Roles that may list or download admin_files for cross-pillar attach. */
export function canUseAdminFilePicker(role: Role): boolean {
  return (
    canSurface(role, "admin", "storage") ||
    can(role, "finance") ||
    can(role, "operations") ||
    canUseLeads(role)
  );
}

const FINANCE_UPLOAD_CATEGORIES = new Set<AdminFileCategory>(["receipt", "finance"]);
const OPERATIONS_UPLOAD_CATEGORIES = new Set<AdminFileCategory>([
  "operations",
  "contract",
]);
const SALES_UPLOAD_CATEGORIES = new Set<AdminFileCategory>(["contract", "other"]);

/** Full Admin Storage UI — any category. */
export function hasFullAdminStorageAccess(role: Role): boolean {
  return canSurface(role, "admin", "storage") && role !== "hr_officer";
}

/** Module-scoped upload from attach UIs (category required). */
export function canUploadAdminStorageCategory(
  role: Role,
  category: AdminFileCategory,
): boolean {
  if (hasFullAdminStorageAccess(role)) return true;
  if (role === "hr_officer") return category === "hr_doc";
  if (can(role, "finance") && FINANCE_UPLOAD_CATEGORIES.has(category)) return true;
  if (can(role, "operations") && OPERATIONS_UPLOAD_CATEGORIES.has(category)) {
    return true;
  }
  if (canUseLeads(role) && SALES_UPLOAD_CATEGORIES.has(category)) return true;
  return false;
}
