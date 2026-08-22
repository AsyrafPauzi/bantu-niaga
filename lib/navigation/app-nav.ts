import {
  Banknote,
  BarChart3,
  Boxes,
  Calendar,
  FileText,
  Home,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Menu,
  Settings,
  ShoppingCart,
  Sparkles,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Pillar } from "@/lib/auth/entitlements";
import type { BusinessType } from "@/lib/onboarding/plan-quiz";
import { getOperationsNavSubItems } from "@/lib/operations/vertical";
import { can, canSurface, type Role } from "@/lib/permissions";

export interface NavSubItem {
  href: string;
  label: string;
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  pillar?: Pillar;
  subItems?: readonly NavSubItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const MODULE_NAV_ITEMS: readonly Omit<NavItem, "subItems">[] = [
  {
    href: "/admin",
    label: "Admin",
    icon: FileText,
    pillar: "admin",
  },
  {
    href: "/finance",
    label: "Finance",
    icon: Banknote,
    pillar: "finance",
  },
  {
    href: "/operations",
    label: "Operations",
    icon: Boxes,
    pillar: "operations",
  },
  {
    href: "/marketing",
    label: "Marketing",
    icon: Megaphone,
    pillar: "marketing",
  },
  {
    href: "/sales",
    label: "Sales",
    icon: ShoppingCart,
    pillar: "sales",
  },
  {
    href: "/hr",
    label: "HR",
    icon: Users,
    pillar: "hr",
  },
];

const ADMIN_SUB: readonly NavSubItem[] = [
  { href: "/admin/storage", label: "Storage" },
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/compliance", label: "Compliance" },
  { href: "/admin/documents", label: "Templates & notes" },
];

const FINANCE_SUB: readonly NavSubItem[] = [
  { href: "/finance/invoices", label: "Invoices" },
  { href: "/finance/income", label: "Income" },
  { href: "/finance/expenses", label: "Expenses" },
  { href: "/finance/reports", label: "Reports" },
  { href: "/finance/customers", label: "Customers" },
];

const MARKETING_SUB: readonly NavSubItem[] = [
  { href: "/marketing/customers", label: "Customers" },
  { href: "/marketing/segments", label: "Segments" },
  { href: "/marketing/content", label: "Content" },
  { href: "/marketing/broadcasts", label: "Broadcasts" },
  { href: "/marketing/coupons", label: "Coupons" },
];

const SALES_SUB: readonly NavSubItem[] = [
  { href: "/sales/pos", label: "POS" },
  { href: "/sales/leads", label: "Leads" },
];

const HR_SUB: readonly NavSubItem[] = [
  { href: "/hr", label: "Overview" },
  { href: "/hr/employees", label: "Employees" },
  { href: "/hr/leave", label: "Leave" },
  { href: "/hr/holidays", label: "Public holidays" },
];

function subItemsForModule(href: string): readonly NavSubItem[] | undefined {
  switch (href) {
    case "/admin":
      return ADMIN_SUB;
    case "/finance":
      return FINANCE_SUB;
    case "/marketing":
      return MARKETING_SUB;
    case "/sales":
      return SALES_SUB;
    case "/hr":
      return HR_SUB;
    default:
      return undefined;
  }
}

/** Desktop sidebar + mobile drawer — single source of truth. */
export function buildAppNavGroups(
  businessType?: BusinessType | null,
): NavGroup[] {
  const opsSubItems = getOperationsNavSubItems(businessType);

  const modules: NavItem[] = MODULE_NAV_ITEMS.map((item) => {
    if (item.href === "/operations") {
      return { ...item, subItems: opsSubItems };
    }
    const subItems = subItemsForModule(item.href);
    return subItems ? { ...item, subItems } : item;
  });

  return [
    {
      label: "Overview",
      items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
    },
    { label: "Modules", items: modules },
    {
      label: "Platform",
      items: [
        { href: "/boardroom", label: "Boardroom", icon: Sparkles },
        { href: "/marketplace", label: "Marketplace", icon: Store },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ];
}

/**
 * Hide nav the current Team role cannot use. Subscription locks still apply
 * separately via `hasPillar` in the shell.
 */
export function filterAppNavGroupsForRole(
  groups: NavGroup[],
  role: Role,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => filterNavItemForRole(item, role))
        .filter((item): item is NavItem => item !== null),
    }))
    .filter((group) => group.items.length > 0);
}

function filterNavItemForRole(item: NavItem, role: Role): NavItem | null {
  if (item.href === "/") return item;
  if (item.href === "/settings") return item;

  if (item.href === "/boardroom") {
    return can(role, "boardroom") ? item : null;
  }
  if (item.href === "/marketplace") {
    return can(role, "marketplace") ? item : null;
  }

  if (!item.pillar) return item;
  if (!can(role, item.pillar)) return null;

  // Narrow roles: deep-link to the one surface they actually use.
  if (role === "staff" && item.pillar === "hr") {
    return {
      ...item,
      href: "/hr/me",
      label: "My HR",
      subItems: undefined,
    };
  }
  if (role === "staff" && item.pillar === "admin") {
    return {
      ...item,
      href: "/admin/tasks",
      label: "Tasks",
      subItems: undefined,
    };
  }
  if (role === "cashier" && item.pillar === "sales") {
    return {
      ...item,
      href: "/sales/pos",
      label: "POS",
      subItems: undefined,
    };
  }

  if (!item.subItems?.length) return item;

  const filteredSubs = item.subItems.filter((sub) =>
    navSubItemAllowed(role, item.pillar!, sub.href),
  );

  // If they only have partial surface access and every overview sub-route
  // was stripped, keep the pillar root when any surface remains — otherwise
  // drop empty modules.
  if (filteredSubs.length === 0) {
    // Operations / full-* pillars with unknown sub paths: keep root.
    if (item.pillar === "operations") return item;
    return null;
  }

  return { ...item, subItems: filteredSubs };
}

function navSubItemAllowed(
  role: Role,
  pillar: Pillar,
  href: string,
): boolean {
  const surface = surfaceKeyFromHref(href);
  if (!surface) {
    // Pillar overview link (e.g. /hr) — allow when role has any access.
    return can(role, pillar);
  }
  return canSurface(role, pillar, surface);
}

function surfaceKeyFromHref(href: string): string | null {
  const parts = href.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  // /hr → overview (no surface key)
  if (parts.length === 1) return null;
  const leaf = parts[parts.length - 1]!;
  // Map path segments that differ from permission surface keys.
  if (leaf === "storage") return "storage";
  if (leaf === "tasks") return "tasks";
  if (leaf === "compliance") return "compliance";
  if (leaf === "documents") return "documents";
  if (href === "/hr") return null;
  if (href.startsWith("/hr/")) {
    if (leaf === "employees") return "employees";
    if (leaf === "leave") return "leave";
    if (leaf === "holidays") return "holidays";
    if (leaf === "me") return "leave";
  }
  return leaf;
}

export function isNavSectionActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/hr") {
    // Full HR module — do not treat /hr/me as the manager HR section.
    if (pathname === "/hr/me" || pathname.startsWith("/hr/me/")) return false;
    return pathname === "/hr" || pathname.startsWith("/hr/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavSubItemActive(href: string, pathname: string): boolean {
  if (href === "/hr") return pathname === "/hr";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type MobileBottomTab =
  | {
      kind: "link";
      href: string;
      label: string;
      icon: LucideIcon;
      pillar?: Pillar;
    }
  | {
      kind: "menu";
      label: string;
      icon: LucideIcon;
    };

/** High-frequency mobile shortcuts — everything else lives in the menu drawer. */
export const MOBILE_BOTTOM_TABS: readonly MobileBottomTab[] = [
  { kind: "link", href: "/", label: "Home", icon: Home },
  {
    kind: "link",
    href: "/sales/pos",
    label: "POS",
    icon: ShoppingCart,
    pillar: "sales",
  },
  {
    kind: "link",
    href: "/finance",
    label: "Money",
    icon: Banknote,
    pillar: "finance",
  },
  {
    kind: "link",
    href: "/operations",
    label: "Ops",
    icon: Boxes,
    pillar: "operations",
  },
  { kind: "menu", label: "Menu", icon: Menu },
];

const CASHIER_BOTTOM_TABS: readonly MobileBottomTab[] = [
  {
    kind: "link",
    href: "/sales/pos",
    label: "POS",
    icon: ShoppingCart,
    pillar: "sales",
  },
  {
    kind: "link",
    href: "/sales",
    label: "Today",
    icon: LayoutDashboard,
    pillar: "sales",
  },
  { kind: "menu", label: "Menu", icon: Menu },
];

const STAFF_BOTTOM_TABS: readonly MobileBottomTab[] = [
  {
    kind: "link",
    href: "/admin/tasks",
    label: "Tasks",
    icon: ListChecks,
    pillar: "admin",
  },
  {
    kind: "link",
    href: "/hr/me",
    label: "Leave",
    icon: Calendar,
    pillar: "hr",
  },
  { kind: "menu", label: "Menu", icon: Menu },
];

const ACCOUNTANT_BOTTOM_TABS: readonly MobileBottomTab[] = [
  {
    kind: "link",
    href: "/finance",
    label: "Money",
    icon: Banknote,
    pillar: "finance",
  },
  {
    kind: "link",
    href: "/finance/reports",
    label: "Reports",
    icon: BarChart3,
    pillar: "finance",
  },
  { kind: "menu", label: "Menu", icon: Menu },
];

/** Role-aware bottom tabs — owner/manager and other roles use the default five-tab bar. */
export function getMobileBottomTabsForRole(role: Role): readonly MobileBottomTab[] {
  switch (role) {
    case "cashier":
      return CASHIER_BOTTOM_TABS;
    case "staff":
      return STAFF_BOTTOM_TABS;
    case "accountant":
      return ACCOUNTANT_BOTTOM_TABS;
    default:
      return MOBILE_BOTTOM_TABS;
  }
}

export function mobileBottomTabGridClass(tabCount: number): string {
  if (tabCount <= 3) return "grid-cols-3";
  if (tabCount === 4) return "grid-cols-4";
  return "grid-cols-5";
}

export function mobileTabActive(
  tab: MobileBottomTab,
  pathname: string,
  menuOpen: boolean,
): boolean {
  if (tab.kind === "menu") return menuOpen;
  if (tab.href === "/") return pathname === "/";
  if (tab.href === "/sales/pos") {
    return pathname === "/sales/pos" || pathname.startsWith("/sales/pos/");
  }
  if (tab.href === "/sales") {
    return pathname === "/sales";
  }
  if (tab.href === "/hr/me") {
    return pathname === "/hr/me" || pathname.startsWith("/hr/me/");
  }
  if (tab.href === "/admin/tasks") {
    return pathname.startsWith("/admin/tasks");
  }
  if (tab.href === "/finance/reports") {
    return pathname.startsWith("/finance/reports");
  }
  return isNavSectionActive(tab.href, pathname);
}
