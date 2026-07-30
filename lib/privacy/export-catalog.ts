export type ExportScope = "personal" | "business";

export type PersonalExportCategoryId =
  | "profile"
  | "consents"
  | "privacy_requests"
  | "audit_actions"
  | "marketing_created"
  | "customers_created";

export type BusinessExportCategoryId =
  | "business_profile"
  | "team"
  | "customers"
  | "finance"
  | "operations"
  | "sales"
  | "marketing"
  | "hr"
  | "integrations"
  | "audit_log";

export type ExportCategoryId =
  | PersonalExportCategoryId
  | BusinessExportCategoryId;

export interface ExportCategoryDescriptor {
  id: ExportCategoryId;
  scope: ExportScope;
  label: string;
  description: string;
  ownerOnly: boolean;
}

export const EXPORT_CATEGORIES: readonly ExportCategoryDescriptor[] = [
  {
    id: "profile",
    scope: "personal",
    label: "My profile",
    description: "Name, email, phone, and role.",
    ownerOnly: false,
  },
  {
    id: "consents",
    scope: "personal",
    label: "Consent history",
    description: "Every consent you granted or withdrew.",
    ownerOnly: false,
  },
  {
    id: "privacy_requests",
    scope: "personal",
    label: "Privacy requests",
    description: "Exports, deletions, and consent changes you made.",
    ownerOnly: false,
  },
  {
    id: "audit_actions",
    scope: "personal",
    label: "Actions I took",
    description: "Audit log entries where you were the actor.",
    ownerOnly: false,
  },
  {
    id: "marketing_created",
    scope: "personal",
    label: "Content I created",
    description: "Content calendar entries and social accounts you connected.",
    ownerOnly: false,
  },
  {
    id: "customers_created",
    scope: "personal",
    label: "Customers I added",
    description: "CRM customer records you created.",
    ownerOnly: false,
  },
  {
    id: "business_profile",
    scope: "business",
    label: "Business profile",
    description: "Business name, plan, branding, and settings.",
    ownerOnly: true,
  },
  {
    id: "team",
    scope: "business",
    label: "Team & invites",
    description: "Staff accounts, roles, and pending invites.",
    ownerOnly: true,
  },
  {
    id: "customers",
    scope: "business",
    label: "All customers",
    description: "Full CRM — every customer in this business.",
    ownerOnly: true,
  },
  {
    id: "finance",
    scope: "business",
    label: "Finance",
    description: "Invoices, transactions, quotes, and credit ledger.",
    ownerOnly: true,
  },
  {
    id: "operations",
    scope: "business",
    label: "Operations",
    description: "Products, orders, bookings, and suppliers.",
    ownerOnly: true,
  },
  {
    id: "sales",
    scope: "business",
    label: "Sales",
    description: "POS sales, leads, and lead notes.",
    ownerOnly: true,
  },
  {
    id: "marketing",
    scope: "business",
    label: "Marketing",
    description: "Broadcasts, coupons, segments, and content library.",
    ownerOnly: true,
  },
  {
    id: "hr",
    scope: "business",
    label: "HR",
    description: "Employees, leave, appraisals, and AI usage.",
    ownerOnly: true,
  },
  {
    id: "integrations",
    scope: "business",
    label: "Integrations",
    description: "API key labels (no secrets) and webhook URLs.",
    ownerOnly: true,
  },
  {
    id: "audit_log",
    scope: "business",
    label: "Full audit log",
    description: "Every audited action in this business.",
    ownerOnly: true,
  },
] as const;

export const EXPORT_ROW_LIMIT = 5000;

export function categoriesForScope(scope: ExportScope): ExportCategoryId[] {
  return EXPORT_CATEGORIES.filter((c) => c.scope === scope).map((c) => c.id);
}

export function isCategoryAllowedForScope(
  categoryId: ExportCategoryId,
  scope: ExportScope,
): boolean {
  const descriptor = EXPORT_CATEGORIES.find((c) => c.id === categoryId);
  return descriptor?.scope === scope;
}
