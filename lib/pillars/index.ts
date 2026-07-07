/**
 * Pillar registry — single source of truth for navigation and feature gating.
 *
 * Each pillar entry describes the URL root and the surfaces it exposes.
 * Both shells (Mobile + Desktop) read from this list to render navigation.
 */

import type { Pillar } from "@/lib/permissions";

export interface PillarSurface {
  href: string;
  label: string;
  /** Where this surface is primarily used. Helps the shells choose what to highlight. */
  primary: "mobile" | "desktop" | "both";
}

export interface PillarMeta {
  id: Pillar;
  label: string;
  short: string;
  href: string;
  description: string;
  surfaces: PillarSurface[];
}

export const PILLAR_META: Record<Pillar, PillarMeta> = {
  admin: {
    id: "admin",
    label: "Admin",
    short: "Admin",
    href: "/admin",
    description: "Daily back-office: documents, tasks, notifications, compliance.",
    surfaces: [
      { href: "/admin/tasks", label: "Tasks", primary: "both" },
      { href: "/admin/compliance", label: "Compliance", primary: "both" },
      { href: "/admin/documents", label: "Documents", primary: "desktop" },
      { href: "/admin/storage", label: "Storage", primary: "desktop" },
    ],
  },
  finance: {
    id: "finance",
    label: "Finance",
    short: "Money",
    href: "/finance",
    description: "Track money, send invoices, stay LHDN-compliant.",
    surfaces: [
      { href: "/finance/invoices", label: "Invoices", primary: "both" },
      { href: "/finance/customers", label: "Customers", primary: "desktop" },
      { href: "/finance/expenses", label: "Expenses", primary: "mobile" },
      { href: "/finance/ledger", label: "Ledger", primary: "desktop" },
    ],
  },
  operations: {
    id: "operations",
    label: "Operations",
    short: "Ops",
    href: "/operations",
    description: "Move work from order to delivery; suppliers, products, bookings.",
    surfaces: [
      { href: "/operations/orders", label: "Orders", primary: "both" },
      { href: "/operations/bookings", label: "Bookings", primary: "both" },
      { href: "/operations/products", label: "Products", primary: "desktop" },
      { href: "/operations/suppliers", label: "Suppliers", primary: "desktop" },
    ],
  },
  marketing: {
    id: "marketing",
    label: "Marketing",
    short: "Reach",
    href: "/marketing",
    description: "Reach customers and keep them coming back.",
    surfaces: [
      { href: "/marketing/customers", label: "Customers", primary: "both" },
      { href: "/marketing/content", label: "Content", primary: "desktop" },
      { href: "/marketing/segments", label: "Segments", primary: "desktop" },
      { href: "/marketing/broadcasts", label: "Broadcasts", primary: "desktop" },
      { href: "/marketing/coupons", label: "Coupons", primary: "desktop" },
    ],
  },
  sales: {
    id: "sales",
    label: "Sales",
    short: "Sales",
    href: "/sales",
    description: "Track leads and take payment at the counter.",
    surfaces: [
      { href: "/sales/pos", label: "POS", primary: "mobile" },
      { href: "/sales/leads", label: "Leads", primary: "both" },
    ],
  },
  hr: {
    id: "hr",
    label: "HR",
    short: "HR",
    href: "/hr",
    description: "Employees, leave, public holidays, contracts.",
    surfaces: [
      { href: "/hr", label: "Overview", primary: "both" },
      { href: "/hr/employees", label: "Employees", primary: "desktop" },
      { href: "/hr/leave", label: "Leave", primary: "both" },
      { href: "/hr/leave/policy", label: "Leave policy (add-on)", primary: "desktop" },
      { href: "/hr/staff-portal", label: "Staff portal (add-on)", primary: "desktop" },
      { href: "/hr/holidays", label: "Public holidays", primary: "desktop" },
      { href: "/hr/appraisals", label: "Staff appraisals", primary: "desktop" },
      { href: "/hr/documents", label: "Staff documents", primary: "desktop" },
      { href: "/hr/assistant", label: "AI Assistant", primary: "both" },
    ],
  },
};

export const PILLAR_LIST: PillarMeta[] = [
  PILLAR_META.admin,
  PILLAR_META.finance,
  PILLAR_META.operations,
  PILLAR_META.marketing,
  PILLAR_META.sales,
  PILLAR_META.hr,
];
