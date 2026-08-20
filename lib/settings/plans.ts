/**
 * Bantu Niaga — plan catalog (pricing-plan v2026-08).
 *
 * Single source of truth for tier metadata. Mirrored in subscription UI
 * and upsell logic. Pillar gates: `lib/auth/entitlements.ts`.
 */
export type TierKey = "starter" | "basic" | "micro" | "sme" | "enterprise";

export interface Tier {
  key: TierKey;
  label: string;
  priceMyr: number | null;
  /** Annual price = priceMyr × 10 (pay-10-get-12). Undefined for Free / Scale tiers. */
  annualPriceMyr?: number;
  cadence: string;
  blurb: string;
  features: string[];
  quotas: {
    seats: number;
    customers: number;
    /** Storage quota in megabytes. */
    storageMb: number;
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
    blurb: "Try invoicing — Finance lite only.",
    features: [
      "Finance lite (income, invoices, payment tracking)",
      "25 invoices / month · 50 saved customers",
      "200 MB storage · no AI agents",
      "Upgrade for expenses, DuitNow, and full modules",
    ],
    quotas: {
      seats: 1,
      customers: 50,
      storageMb: 200,
      fastCreditsMonthly: 0,
    },
  },
  {
    key: "basic",
    label: "Basic",
    priceMyr: 39,
    annualPriceMyr: 39 * 10,
    cadence: "/month",
    blurb: "Freelancers — Admin, Sales, and Finance desk.",
    features: [
      "Admin + Sales + Finance modules",
      "3 AI agents (Amir, Sufi, Fayza) · ILMU Mini 3.3",
      "60 AI credits / month",
      "1 GB storage · 1 seat · 200 customers",
    ],
    quotas: {
      seats: 1,
      customers: 200,
      storageMb: 1024,
      fastCreditsMonthly: 60,
    },
  },
  {
    key: "micro",
    label: "Solo",
    priceMyr: 79,
    annualPriceMyr: 79 * 10,
    cadence: "/month",
    blurb: "Full six-module stack for solo owners.",
    features: [
      "All six core modules + Boardroom",
      "All 6 AI agents included · 120 credits / month",
      "5 GB storage · 1 seat · 500 customers",
      "Unlimited email (COGS-guarded)",
    ],
    quotas: {
      seats: 1,
      customers: 500,
      storageMb: 5120,
      fastCreditsMonthly: 120,
    },
  },
  {
    key: "sme",
    label: "Micro",
    priceMyr: 169,
    annualPriceMyr: 169 * 10,
    cadence: "/month",
    blurb: "Primary tier for micro teams.",
    features: [
      "All six modules + 6 AI agents",
      "180 AI credits / month",
      "15 GB storage · 5 seats · 2,000 customers",
      "Unlimited email (COGS-guarded)",
    ],
    quotas: {
      seats: 5,
      customers: 2_000,
      storageMb: 15_360,
      fastCreditsMonthly: 180,
    },
    highlighted: true,
  },
  {
    key: "enterprise",
    label: "Small",
    priceMyr: 299,
    annualPriceMyr: 299 * 10,
    cadence: "/month",
    blurb: "Growing SMEs with larger teams.",
    features: [
      "All six modules + 6 AI agents",
      "360 AI credits / month",
      "40 GB storage · 12 seats · 10,000 customers",
      "Unlimited email (COGS-guarded)",
    ],
    quotas: {
      seats: 12,
      customers: 10_000,
      storageMb: 40_960,
      fastCreditsMonthly: 360,
    },
  },
];

export const ADDONS = [
  { label: "Extra staff seat", priceMyr: 9, cadence: "/seat / month" },
  { label: "Extra 10 GB storage", priceMyr: 5, cadence: "/month" },
  { label: "100 AI credits top-up", priceMyr: 10, cadence: "one-time" },
  { label: "300 AI credits top-up", priceMyr: 28, cadence: "one-time" },
  { label: "Recurring invoices", priceMyr: 9, cadence: "/month" },
  { label: "Customer booking page", priceMyr: 9, cadence: "/month" },
  { label: "Bank reconciliation", priceMyr: 14, cadence: "/month" },
  { label: "WhatsApp Business API", priceMyr: 16, cadence: "/month + Meta" },
];

export function tierBy(key: TierKey | string): Tier | undefined {
  return TIERS.find((t) => t.key === key);
}

export function tierStorageQuotaBytes(tier: TierKey | string): number | null {
  const tierDef = tierBy(tier);
  if (!tierDef) return null;
  const mb = tierDef.quotas.storageMb;
  if (!Number.isFinite(mb)) return null;
  return mb * 1024 * 1024;
}

export function tierLabel(key: TierKey | string): string {
  return tierBy(key)?.label ?? String(key);
}
