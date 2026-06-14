/**
 * Bantu Niaga — plan catalog.
 *
 * Single source of truth for tier metadata. Mirrored in the marketing
 * site, the subscription settings page, and the Maya upsell logic.
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
    blurb: "Solo founders who need basic bookkeeping.",
    features: [
      "Finance module only (invoices, expenses, ledger)",
      "1 owner seat",
      "Up to 200 customers",
      "5 GB storage",
      "Maya · 25 fast credits/month",
    ],
    quotas: { seats: 1, customers: 200, storageGb: 5, fastCreditsMonthly: 25 },
  },
  {
    key: "micro",
    label: "Plus",
    priceMyr: 80,
    cadence: "/month",
    blurb: "Small teams running shop + admin + ops.",
    features: [
      "Finance + Admin + Operations modules",
      "3 staff seats",
      "Up to 2,000 customers",
      "20 GB storage",
      "Maya + Operations AI · 150 credits",
    ],
    quotas: { seats: 3, customers: 2_000, storageGb: 20, fastCreditsMonthly: 150 },
  },
  {
    key: "sme",
    label: "Growth",
    priceMyr: 120,
    cadence: "/month",
    blurb: "Multi-channel SMEs with a sales floor + team.",
    features: [
      "Finance + Admin + Ops + Sales + HR modules",
      "5 staff seats",
      "Up to 10,000 customers",
      "50 GB storage",
      "All 3 AI agents · 300 credits",
    ],
    quotas: { seats: 5, customers: 10_000, storageGb: 50, fastCreditsMonthly: 300 },
    highlighted: true,
  },
  {
    key: "enterprise",
    label: "Pro",
    priceMyr: 220,
    cadence: "/month",
    blurb: "Established SMEs that also run brand + content.",
    features: [
      "All 6 modules including Marketing (CRM + content)",
      "Unlimited seats",
      "Unlimited customers",
      "Custom storage",
      "All 4 AI agents · 600 credits",
    ],
    quotas: {
      seats: Number.POSITIVE_INFINITY,
      customers: Number.POSITIVE_INFINITY,
      storageGb: Number.POSITIVE_INFINITY,
      fastCreditsMonthly: 600,
    },
  },
];

export const ADDONS = [
  { label: "Extra staff seat", priceMyr: 15, cadence: "/seat / month" },
  { label: "Extra 10 GB storage", priceMyr: 8, cadence: "/month" },
  { label: "Fast Credits top-up", priceMyr: 10, cadence: "/ 50 credits" },
  { label: "WhatsApp Business API", priceMyr: 35, cadence: "/month" },
];

export function tierBy(key: TierKey | string): Tier | undefined {
  return TIERS.find((t) => t.key === key);
}
