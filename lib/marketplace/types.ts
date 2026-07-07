/**
 * Shared types for the Marketplace pillar.
 *
 * - `MarketplaceAddon` mirrors the row shape of `public.marketplace_addons`.
 * - `BusinessAddon` mirrors `public.business_addons`.
 * - `CatalogEntry` joins them: the catalog item + the current business's
 *   activation state (null when not activated).
 *
 * The Activate/Deactivate RPC return rows of `BusinessAddon`.
 */

export type AddonPillar =
  | "admin"
  | "finance"
  | "operations"
  | "sales"
  | "marketing"
  | "hr"
  | "ai"
  | "cross";

export type AddonCadence = "monthly" | "yearly" | "one_time" | "included";

export type AddonStatus = "active" | "pending_cancel" | "cancelled";

export interface MarketplaceAddon {
  id: string;
  slug: string;
  name: string;
  short_desc: string;
  long_desc: string | null;
  pillar: AddonPillar;
  icon: string;
  price_cents: number;
  cadence: AddonCadence;
  included_in_tier: string[];
  is_featured: boolean;
  sort_order: number;
  is_coming_soon: boolean;
}

export interface BusinessAddon {
  id: string;
  business_id: string;
  addon_id: string;
  status: AddonStatus;
  activated_at: string;
  next_charge_at: string | null;
  cancel_at: string | null;
  qty: number;
  meta: Record<string, unknown>;
}

export interface CatalogEntry {
  addon: MarketplaceAddon;
  activation: BusinessAddon | null;
}

export const PILLAR_LABEL: Record<AddonPillar, string> = {
  admin: "Admin",
  finance: "Finance",
  operations: "Operations",
  sales: "Sales",
  marketing: "Marketing",
  hr: "HR",
  ai: "AI agents",
  cross: "Cross-cutting",
};

export const CADENCE_LABEL: Record<AddonCadence, string> = {
  monthly: "/month",
  yearly: "/year",
  one_time: "one-time",
  included: "included",
};

export function formatMyr(priceCents: number): string {
  if (priceCents === 0) return "Free";
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
  }).format(priceCents / 100);
}
