import { tierBy, type TierKey } from "@/lib/settings/plans";
import { permissions, ROLES, type Role } from "@/lib/permissions";

export interface TeamMemberRow {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  created_at: string;
  last_password_change_at: string | null;
}

export interface TeamInviteRow {
  id: string;
  email: string;
  role: Role;
  display_name: string | null;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expires_at: string;
  created_at: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  accountant: "Accountant",
  hr_officer: "HR Officer",
  cashier: "Cashier",
  staff: "Staff",
  marketing_officer: "Marketing Officer",
  operations_officer: "Operations Officer",
  sales_rep: "Sales Rep",
};

/** One-line hint shown when picking a role in Team settings. */
export const ROLE_HINTS: Record<Role, string> = {
  owner: "Full access to everything, including billing and team management.",
  manager: "Runs the business day-to-day — all modules except billing and team.",
  accountant: "Finance, invoices, expenses, and LHDN records.",
  hr_officer: "Employee records, leave, payroll docs, and onboarding.",
  cashier: "Point of sale — ring up sales and redeem coupons.",
  staff: "Assigned tasks and own leave requests only.",
  marketing_officer:
    "Customers, content calendar, segments, broadcasts, and coupons.",
  operations_officer: "Stock, suppliers, purchase orders, and bookings.",
  sales_rep: "Lead pipeline and read-only POS — for field sales staff.",
};

export const INVITEABLE_ROLES = [
  "manager",
  "accountant",
  "hr_officer",
  "cashier",
  "staff",
  "marketing_officer",
  "operations_officer",
  "sales_rep",
] as const satisfies readonly Role[];

export type InviteableRole = (typeof INVITEABLE_ROLES)[number];

export function roleSummary(role: Role): string {
  const p = permissions[role];
  const pillars: string[] = [];
  if (p.admin === "*") pillars.push("Admin");
  else if (p.admin) pillars.push("Admin (limited)");
  if (p.finance === "*") pillars.push("Finance");
  if (p.operations === "*") pillars.push("Operations");
  if (p.marketing === "*") pillars.push("Marketing");
  if (p.sales === "*") pillars.push("Sales");
  if (p.hr === "*") pillars.push("HR");
  if (p.billing === "*") pillars.push("Billing");
  if (p.team === "*") pillars.push("Team");
  return pillars.length > 0 ? pillars.join(" · ") : "Limited access";
}

export function seatQuota(tier: TierKey): number {
  const t = tierBy(tier);
  const seats = t?.quotas.seats ?? 1;
  return Number.isFinite(seats) ? seats : 999;
}

export { ROLES };
