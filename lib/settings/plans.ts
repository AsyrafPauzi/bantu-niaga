/**
 * Bantu Niaga — plan catalog.
 *
 * Single source of truth for tier metadata. Mirrored in the marketing
 * site, the subscription settings page, and upsell logic.
 *
 * Each tier unlocks a strictly larger bundle of pillar modules — see
 * `lib/auth/entitlements.ts` for the canonical module mapping that the
 * sidebar, page guards, and home tiles all read from.
 */
export type TierKey = "starter" | "micro" | "sme" | "enterprise";

export interface Tier {
  key: TierKey;
  label: string;
  priceMyr: number | null; // null = custom
  cadence: string;
  blurb: string;
  features: string[];
  /** Quotas enforced by the app. */
  quotas: {
    seats: number;
    customers: number;
    storageGb: number;
    fastCreditsMonthly: number;
  };
  highlighted?: boolean;
}

export const TIERS: readonly Tier[] = [
  {
    key: "starter",
    label: "Free",
    priceMyr: 0,
    cadence: "/month",
    blurb: "Solo founders who need invoice and payment tracking.",
    features: [
      "Finance Lite (income, invoices, payment tracking)",
      "1 owner seat",
      "No saved customer database",
      "5 GB storage",
      "Upgrade required for add-ons and AI agents",
    ],
    quotas: { seats: 1, customers: 0, storageGb: 5, fastCreditsMonthly: 0 },
  },
  {
    key: "micro",
    label: "Starter",
    priceMyr: 69,
    cadence: "/month",
    blurb: "Small teams running shop + admin + ops.",
    features: [
      "Finance + Admin + Operations modules",
      "3 staff seats",
      "Up to 2,000 customers",
      "20 GB storage",
      "AI agents available as add-ons",
    ],
    quotas: { seats: 3, customers: 2_000, storageGb: 20, fastCreditsMonthly: 0 },
  },
  {
    key: "sme",
    label: "Growth",
    priceMyr: 139,
    cadence: "/month",
    blurb: "Multi-channel SMEs with a sales floor + team.",
    features: [
      "Finance + Admin + Ops + Sales + HR modules",
      "5 staff seats",
      "Up to 10,000 customers",
      "50 GB storage",
      "AI agents available as add-ons",
    ],
    quotas: { seats: 5, customers: 10_000, storageGb: 50, fastCreditsMonthly: 0 },
    highlighted: true,
  },
  {
    key: "enterprise",
    label: "Pro",
    priceMyr: 249,
    cadence: "/month",
    blurb: "Established SMEs that also run brand + content.",
    features: [
      "All 6 modules including Marketing (CRM + content)",
      "Unlimited seats",
      "Unlimited customers",
      "Custom storage",
      "AI agents available as add-ons",
    ],
    quotas: {
      seats: Number.POSITIVE_INFINITY,
      customers: Number.POSITIVE_INFINITY,
      storageGb: Number.POSITIVE_INFINITY,
      fastCreditsMonthly: 0,
    },
  },
];

export const ADDONS = [
  { label: "Extra staff seat", priceMyr: 15, cadence: "/seat / month" },
  { label: "Extra 10 GB storage", priceMyr: 8, cadence: "/month" },
  { label: "Fast Credits top-up", priceMyr: 10, cadence: "/ 100 credits" },
  { label: "Per-module AI Agent", priceMyr: 20, cadence: "/agent / month" },
  { label: "Dynamic DuitNow QR", priceMyr: 20, cadence: "/month" },
  { label: "Customer Booking Page", priceMyr: 25, cadence: "/month" },
  { label: "WhatsApp Business API", priceMyr: 35, cadence: "/month" },
];

export function tierBy(key: TierKey | string): Tier | undefined {
  return TIERS.find((t) => t.key === key);
}
