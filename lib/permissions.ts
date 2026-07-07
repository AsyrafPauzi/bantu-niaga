/**
 * Bantu Niaga — Permissions Matrix.
 *
 * Single source of truth for the 9-role × 6-pillar RBAC model.
 * Read by all three enforcement layers:
 *   1. Postgres RLS policies (last line of defense)
 *   2. Next.js API middleware (fast-fail)
 *   3. <RequirePermission> React component (UI hide)
 *
 * Adding a feature = add one row here. The other layers update.
 *
 * See `docs/architecture/tech-stack.md` §8 for the full reasoning.
 */

export const PILLARS = [
  "admin",
  "finance",
  "operations",
  "marketing",
  "sales",
  "hr",
] as const;
export type Pillar = (typeof PILLARS)[number];

export const ROLES = [
  "owner",
  "manager",
  "accountant",
  "hr_officer",
  "cashier",
  "staff",
  "marketing_officer",
  "operations_officer",
  "sales_rep",
] as const;
export type Role = (typeof ROLES)[number];

/**
 * Per-pillar surface vocabulary. Single source of truth for surface keys
 * the API + UI gates pass to `canSurface(role, pillar, surface)`.
 *
 * Owner + manager have `marketing: "*"` (full access) so `canSurface`
 * returns true for any string. The matrix entries below stay explicit
 * for documentation, ESLint-style guardrails (typos surface as type
 * errors when callers import the constant), and so future per-surface
 * tightening (e.g. revoking only `coupons` from manager) is a
 * one-line change.
 *
 * Spec: docs/superpowers/specs/2026-06-15-marketing-segments-broadcasts-coupons-design.md §7.
 */
export const MARKETING_SURFACES = [
  "customers",
  "content",
  "segments",
  "broadcasts",
  "coupons",
] as const;
export type MarketingSurface = (typeof MARKETING_SURFACES)[number];

/**
 * Per-surface role grants — informational mirror of `permissions` below.
 * Used by tests and lint-style audits to assert spec §7 alignment.
 * Owner + manager still resolve via the pillar-wide `*` short-circuit in
 * `canSurface`; this map declares the intent in the same shape the spec
 * uses so the two stay in sync.
 */
export const MARKETING_SURFACE_GRANTS: Record<
  MarketingSurface,
  Record<Role, "rw" | "r" | "-">
> = {
  customers: {
    owner: "rw",
    manager: "rw",
    accountant: "-",
    hr_officer: "-",
    cashier: "-",
    staff: "-",
    marketing_officer: "rw",
    operations_officer: "-",
    sales_rep: "-",
  },
  content: {
    owner: "rw",
    manager: "rw",
    accountant: "-",
    hr_officer: "-",
    cashier: "-",
    staff: "-",
    marketing_officer: "rw",
    operations_officer: "-",
    sales_rep: "-",
  },
  segments: {
    owner: "rw",
    manager: "rw",
    accountant: "-",
    hr_officer: "-",
    cashier: "-",
    staff: "-",
    marketing_officer: "rw",
    operations_officer: "-",
    sales_rep: "-",
  },
  broadcasts: {
    owner: "rw",
    manager: "rw",
    accountant: "-",
    hr_officer: "-",
    cashier: "-",
    staff: "-",
    marketing_officer: "rw",
    operations_officer: "-",
    sales_rep: "-",
  },
  coupons: {
    owner: "rw",
    manager: "rw",
    accountant: "-",
    hr_officer: "-",
    cashier: "-",
    staff: "-",
    marketing_officer: "rw",
    operations_officer: "-",
    sales_rep: "-",
  },
};

/**
 * Scope syntax:
 *   "*"                         → full read/write on the whole pillar
 *   undefined                   → no access at all
 *   { surface: "rw" | "r" }     → granular per-surface access
 *   { surface: "self_only" }    → row-level scope (only own records)
 *   { surface: "assigned_only" }→ row-level scope (only records assigned to user)
 */
export type PillarAccess =
  | "*"
  | undefined
  | Record<string, "rw" | "r" | "self_only" | "assigned_only" | string>;

export type CrossCuttingScope = "*" | "r" | undefined;

export interface RolePermissions {
  // Pillars
  admin: PillarAccess;
  finance: PillarAccess;
  operations: PillarAccess;
  marketing: PillarAccess;
  sales: PillarAccess;
  hr: PillarAccess;

  // Cross-cutting
  billing: CrossCuttingScope;
  team: CrossCuttingScope;
  marketplace: CrossCuttingScope;
  boardroom: CrossCuttingScope;
}

export const permissions: Record<Role, RolePermissions> = {
  owner: {
    admin: "*",
    finance: "*",
    operations: "*",
    marketing: "*",
    sales: "*",
    hr: "*",
    billing: "*",
    team: "*",
    marketplace: "*",
    boardroom: "*",
  },
  manager: {
    admin: "*",
    finance: "*",
    operations: "*",
    marketing: "*",
    sales: "*",
    hr: "*",
    billing: undefined,
    team: undefined,
    marketplace: "r",
    boardroom: "*",
  },
  accountant: {
    admin: undefined,
    finance: "*",
    operations: undefined,
    marketing: undefined,
    sales: undefined,
    hr: undefined,
    billing: undefined,
    team: undefined,
    marketplace: undefined,
    boardroom: undefined,
  },
  hr_officer: {
    admin: { storage: "rw_hr_docs_only" },
    finance: undefined,
    operations: undefined,
    marketing: undefined,
    sales: undefined,
    hr: "*",
    billing: undefined,
    team: undefined,
    marketplace: undefined,
    boardroom: undefined,
  },
  cashier: {
    admin: undefined,
    finance: undefined,
    operations: undefined,
    marketing: undefined,
    sales: { pos: "rw" },
    hr: undefined,
    billing: undefined,
    team: undefined,
    marketplace: undefined,
    boardroom: undefined,
  },
  staff: {
    admin: { tasks: "assigned_only" },
    finance: undefined,
    operations: undefined,
    marketing: undefined,
    sales: undefined,
    hr: { leave: "self_only" },
    billing: undefined,
    team: undefined,
    marketplace: undefined,
    boardroom: undefined,
  },
  marketing_officer: {
    admin: undefined,
    finance: undefined,
    operations: undefined,
    marketing: "*",
    sales: undefined,
    hr: undefined,
    billing: undefined,
    team: undefined,
    marketplace: "r",
    boardroom: undefined,
  },
  operations_officer: {
    admin: undefined,
    finance: undefined,
    operations: "*",
    marketing: undefined,
    sales: undefined,
    hr: undefined,
    billing: undefined,
    team: undefined,
    marketplace: "r",
    boardroom: undefined,
  },
  sales_rep: {
    admin: undefined,
    finance: undefined,
    operations: undefined,
    marketing: undefined,
    sales: { leads: "rw", pos: "r" },
    hr: undefined,
    billing: undefined,
    team: undefined,
    marketplace: undefined,
    boardroom: undefined,
  },
};

/**
 * Coarse helper: does this role have any access at all to this area?
 *
 * Useful for hiding entire pillars from a sidebar. For surface-level checks
 * (e.g. `cashier` only has POS within Sales), use `canSurface` instead.
 */
export function can(role: Role, area: keyof RolePermissions): boolean {
  const access = permissions[role][area];
  return access !== undefined;
}

/**
 * Granular helper: does this role have access to a specific surface within
 * an area?
 *
 *   "*"       → universally true (full pillar access)
 *   undefined → universally false (no pillar access at all)
 *   object    → true iff the surface key is defined on the access object
 *
 * Examples:
 *   canSurface('cashier', 'sales', 'pos')   → true
 *   canSurface('cashier', 'sales', 'leads') → false
 *   canSurface('owner', 'sales', 'pos')     → true (owner has '*')
 */
export function canSurface(
  role: Role,
  area: keyof RolePermissions,
  surface: string,
): boolean {
  const access = permissions[role][area];
  if (access === undefined) return false;
  if (access === "*") return true;
  if (typeof access === "object" && access !== null) {
    return Object.prototype.hasOwnProperty.call(access, surface);
  }
  return false;
}

/**
 * Returns the raw scope string for a (role, area, surface) triple, or null
 * when the role has no access to that surface.
 *
 * Callers use this to apply row-level filters at the data layer
 * (e.g. `'self_only'` → filter by `created_by = auth.uid()`,
 *  `'assigned_only'` → filter by `assignee_user_id = auth.uid()`).
 *
 *   "*"       → returns "*" (full access)
 *   undefined → returns null
 *   object    → returns the per-surface scope string or null
 */
export function getSurfaceScope(
  role: Role,
  area: keyof RolePermissions,
  surface: string,
): string | null {
  const access = permissions[role][area];
  if (access === undefined) return null;
  if (access === "*") return "*";
  if (typeof access === "object" && access !== null) {
    const scope = (access as Record<string, string>)[surface];
    return scope ?? null;
  }
  return null;
}

export function hasFullAccess(role: Role, area: keyof RolePermissions): boolean {
  return permissions[role][area] === "*";
}
