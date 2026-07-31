import type { BusinessType } from "@/lib/onboarding/plan-quiz";
import { bundleForBusinessType } from "@/lib/onboarding/business-bundles";

export type OperationsSurface =
  | "orders"
  | "products"
  | "services"
  | "bookings"
  | "suppliers"
  | "assistant";

export interface OperationsNavItem {
  href: string;
  label: string;
}

export interface OperationsVerticalProfile {
  businessType: BusinessType;
  bundleId: string | null;
  bundleName: string | null;
  modeLabel: string;
  heroEmoji: string;
  showProducts: boolean;
  showServices: boolean;
  showBookings: boolean;
  showStockAlerts: boolean;
  primarySurfaces: OperationsSurface[];
  navItems: OperationsNavItem[];
  categoryPresets: readonly string[];
  catalogStatLabel: string;
  primaryCta: { href: string; label: string };
}

const SURFACE_META: Record<
  OperationsSurface,
  { href: string; label: string }
> = {
  orders: { href: "/operations/orders", label: "Orders" },
  products: { href: "/operations/products", label: "Products" },
  services: { href: "/operations/services", label: "Services" },
  bookings: { href: "/operations/bookings", label: "Bookings" },
  suppliers: { href: "/operations/suppliers", label: "Suppliers" },
  assistant: { href: "/operations/assistant", label: "Aiman AI" },
};

const CATEGORY_PRESETS: Record<BusinessType, readonly string[]> = {
  fnb: ["Food", "Drinks", "Snacks", "Catering"],
  retail: ["Apparel", "Footwear", "Accessories", "Grocery", "Electronics"],
  services: [
    "Hair & Beauty",
    "Wellness",
    "Consulting",
    "Repair",
    "Homestay",
  ],
  online: ["Fashion", "Electronics", "Home", "Beauty", "Digital"],
  freelancer: ["Consulting", "Design", "Training", "Writing"],
  other: ["General", "Retail", "Food", "Services"],
};

const VERTICAL_PROFILES: Record<
  BusinessType,
  Omit<
    OperationsVerticalProfile,
    | "businessType"
    | "bundleId"
    | "bundleName"
    | "categoryPresets"
    | "navItems"
  >
> = {
  fnb: {
    modeLabel: "Food & beverage",
    heroEmoji: "🍜",
    showProducts: true,
    showServices: false,
    showBookings: true,
    showStockAlerts: true,
    primarySurfaces: [
      "orders",
      "products",
      "bookings",
      "suppliers",
      "assistant",
    ],
    catalogStatLabel: "Products",
    primaryCta: { href: "/operations/orders", label: "New order" },
  },
  retail: {
    modeLabel: "Retail & inventory",
    heroEmoji: "👟",
    showProducts: true,
    showServices: false,
    showBookings: false,
    showStockAlerts: true,
    primarySurfaces: [
      "orders",
      "products",
      "suppliers",
      "bookings",
      "assistant",
    ],
    catalogStatLabel: "Products",
    primaryCta: { href: "/operations/products", label: "Add product" },
  },
  online: {
    modeLabel: "Online seller",
    heroEmoji: "📦",
    showProducts: true,
    showServices: false,
    showBookings: false,
    showStockAlerts: true,
    primarySurfaces: [
      "orders",
      "products",
      "suppliers",
      "assistant",
    ],
    catalogStatLabel: "SKUs",
    primaryCta: { href: "/operations/products", label: "Add SKU" },
  },
  services: {
    modeLabel: "Appointments & services",
    heroEmoji: "📅",
    showProducts: false,
    showServices: true,
    showBookings: true,
    showStockAlerts: false,
    primarySurfaces: [
      "bookings",
      "services",
      "orders",
      "suppliers",
      "assistant",
    ],
    catalogStatLabel: "Services",
    primaryCta: { href: "/operations/bookings", label: "Book slot" },
  },
  freelancer: {
    modeLabel: "Projects & clients",
    heroEmoji: "💼",
    showProducts: false,
    showServices: true,
    showBookings: true,
    showStockAlerts: false,
    primarySurfaces: [
      "orders",
      "services",
      "bookings",
      "assistant",
    ],
    catalogStatLabel: "Services",
    primaryCta: { href: "/operations/orders", label: "New job" },
  },
  other: {
    modeLabel: "General operations",
    heroEmoji: "🏷️",
    showProducts: true,
    showServices: true,
    showBookings: true,
    showStockAlerts: true,
    primarySurfaces: [
      "orders",
      "products",
      "services",
      "bookings",
      "suppliers",
      "assistant",
    ],
    catalogStatLabel: "Catalog",
    primaryCta: { href: "/operations/orders", label: "New order" },
  },
};

export function normalizeBusinessType(
  raw: string | null | undefined,
): BusinessType {
  const valid: BusinessType[] = [
    "retail",
    "fnb",
    "services",
    "online",
    "freelancer",
    "other",
  ];
  if (raw && valid.includes(raw as BusinessType)) {
    return raw as BusinessType;
  }
  return "other";
}

function surfacesToNav(
  surfaces: OperationsSurface[],
): OperationsNavItem[] {
  const seen = new Set<string>();
  const items: OperationsNavItem[] = [];
  for (const surface of surfaces) {
    if (surface === "assistant") continue;
    const meta = SURFACE_META[surface];
    if (seen.has(meta.href)) continue;
    seen.add(meta.href);
    items.push(meta);
  }
  return items;
}

export function getOperationsVerticalProfile(
  businessType: BusinessType,
): OperationsVerticalProfile {
  const base = VERTICAL_PROFILES[businessType];
  const bundle = bundleForBusinessType(businessType);
  return {
    businessType,
    bundleId: bundle?.id ?? null,
    bundleName: bundle?.name ?? null,
    categoryPresets: CATEGORY_PRESETS[businessType],
    navItems: surfacesToNav(base.primarySurfaces),
    ...base,
  };
}

export function getOperationsNavSubItems(
  businessType: BusinessType | null | undefined,
): OperationsNavItem[] {
  return getOperationsVerticalProfile(
    normalizeBusinessType(businessType),
  ).navItems;
}

export function getCategoryPresetsForBusiness(
  businessType: BusinessType | null | undefined,
): readonly string[] {
  return CATEGORY_PRESETS[normalizeBusinessType(businessType)];
}

export function mergeCategoryPresets(
  presets: readonly string[],
  existing: readonly string[],
): string[] {
  const set = new Set<string>([...presets, ...existing]);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
