import type { MarketplaceAddon } from "@/lib/marketplace/types";

export const CREDIT_TOPUP_ADDON_SLUGS = [
  "boost-credits-100",
  "boost-credits-300",
  "boost-credits-500",
] as const;

export type CreditTopupAddonSlug = (typeof CREDIT_TOPUP_ADDON_SLUGS)[number];

/** Marketplace credit packs (pricing-plan §6.3 / §9). */
export const CREDIT_TOPUP_BY_SLUG: Record<
  CreditTopupAddonSlug,
  { credits: number; amount_myr: number }
> = {
  "boost-credits-100": { credits: 100, amount_myr: 10 },
  "boost-credits-300": { credits: 300, amount_myr: 28 },
  "boost-credits-500": { credits: 500, amount_myr: 45 },
};

export function isCreditTopupAddon(addon: MarketplaceAddon | { slug: string }): boolean {
  return (CREDIT_TOPUP_ADDON_SLUGS as readonly string[]).includes(addon.slug);
}

export function isCreditTopupSlug(slug: string): slug is CreditTopupAddonSlug {
  return (CREDIT_TOPUP_ADDON_SLUGS as readonly string[]).includes(slug);
}
