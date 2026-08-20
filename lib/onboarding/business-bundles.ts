import type { TierKey } from "@/lib/settings/plans";
import type { BusinessType, PlanQuizAnswers } from "@/lib/onboarding/plan-quiz";
import { isShippedMarketplaceAddon } from "@/lib/marketplace/shipped-addons";

/** 15% off add-on portion when stacking modules from a business bundle. */
export const BUNDLE_ADDON_DISCOUNT_RATE = 0.15;

export interface BundleAddonRef {
  slug: string;
  /** Shown when slug is not yet in marketplace catalog. */
  plannedLabel?: string;
  /** Opt-in only — e.g. payroll when salaried staff exist. */
  optional?: boolean;
  optionalHint?: string;
}

export interface BusinessBundle {
  id: string;
  name: string;
  tagline: string;
  forBusinessTypes: readonly BusinessType[];
  recommendedTier: TierKey;
  addons: readonly BundleAddonRef[];
}

/**
 * Curated packs for common Malaysian micro-SME profiles.
 * Lists purchasable add-ons only — plan-included agents/modules are omitted.
 */
export const BUSINESS_BUNDLES: readonly BusinessBundle[] = [
  {
    id: "pakej-kedai-runcit",
    name: "Pakej Kedai Runcit",
    tagline: "Mini mart & kedai runcit — resit, stok, portal staf",
    forBusinessTypes: ["retail"],
    recommendedTier: "micro",
    addons: [
      { slug: "storage-10gb" },
      {
        slug: "finance-recurring-invoices",
        plannedLabel: "Invois berulang",
      },
      { slug: "hr-staff-portal" },
    ],
  },
  {
    id: "pakej-kedai-makan",
    name: "Pakej Restoran & Kafe",
    tagline: "Kafe, restoran, warung — portal staf & tempahan pelanggan",
    forBusinessTypes: ["fnb"],
    recommendedTier: "micro",
    addons: [
      { slug: "hr-staff-portal" },
      {
        slug: "customer-booking-page",
        plannedLabel: "Halaman tempahan pelanggan",
      },
      {
        slug: "sales-daily-closeout",
        plannedLabel: "Tutup kas harian",
      },
    ],
  },
  {
    id: "pakej-penjual-online",
    name: "Pakej Penjual Online",
    tagline: "Shopee, TikTok Shop & penjual media sosial",
    forBusinessTypes: ["online"],
    recommendedTier: "micro",
    addons: [
      { slug: "storage-10gb" },
      {
        slug: "marketing-automation",
        plannedLabel: "Automasi marketing",
      },
      {
        slug: "shopee-sync",
        plannedLabel: "Shopee Mall sync",
      },
    ],
  },
  {
    id: "pakej-servis",
    name: "Pakej Servis & Salon",
    tagline: "Salon, klinik, homestay — tempahan & invois",
    forBusinessTypes: ["services"],
    recommendedTier: "micro",
    addons: [
      {
        slug: "customer-booking-page",
        plannedLabel: "Halaman tempahan pelanggan",
      },
      { slug: "hr-staff-portal" },
      {
        slug: "finance-recurring-invoices",
        plannedLabel: "Invois berulang",
      },
    ],
  },
  {
    id: "pakej-usahawan",
    name: "Pakej Usahawan",
    tagline: "Freelancer & perniagaan sendiri — invois & dokumen",
    forBusinessTypes: ["freelancer"],
    recommendedTier: "basic",
    addons: [
      {
        slug: "finance-recurring-invoices",
        plannedLabel: "Invois berulang",
      },
      { slug: "storage-10gb" },
      {
        slug: "admin-digital-signature",
        plannedLabel: "Tandatangan digital",
      },
    ],
  },
  {
    id: "pakej-team-hr",
    name: "Pakej Team & HR",
    tagline: "Kedai dengan staf — cuti, portal, appraisal, laporan",
    forBusinessTypes: ["other"],
    recommendedTier: "sme",
    addons: [
      { slug: "hr-staff-appraisal" },
      { slug: "hr-staff-portal" },
      { slug: "boardroom-weekly" },
    ],
  },
] as const;

export function bundleForBusinessType(
  businessType: BusinessType,
): BusinessBundle | null {
  return (
    BUSINESS_BUNDLES.find((b) => b.forBusinessTypes.includes(businessType)) ??
    BUSINESS_BUNDLES.find((b) => b.id === "pakej-team-hr") ??
    null
  );
}

export function bundleForQuizAnswers(
  answers: PlanQuizAnswers | null,
): BusinessBundle | null {
  if (!answers) return null;
  const byType = bundleForBusinessType(answers.businessType);
  if (byType) return byType;

  if (answers.priorities.includes("marketing") || answers.businessType === "online") {
    return BUSINESS_BUNDLES.find((b) => b.id === "pakej-penjual-online") ?? null;
  }
  if (answers.priorities.includes("leave") || answers.teamSize !== "solo") {
    return BUSINESS_BUNDLES.find((b) => b.id === "pakej-team-hr") ?? byType;
  }
  return BUSINESS_BUNDLES.find((b) => b.id === "pakej-usahawan") ?? null;
}

export interface BundlePricingLine {
  slug: string;
  name: string;
  priceCents: number;
  monthly: boolean;
  comingSoon: boolean;
  optional: boolean;
  active: boolean;
  includedInTier: boolean;
}

export interface BundlePricingSummary {
  bundleId: string;
  bundleName: string;
  recommendedTier: TierKey;
  planPriceCents: number;
  lines: BundlePricingLine[];
  addonSubtotalCents: number;
  bundleAddonSubtotalCents: number;
  savingsCents: number;
  totalAlaCarteCents: number;
  totalBundleCents: number;
  /** Every stack line not active/included is still catalog-only. */
  allStackComingSoon: boolean;
  /** Lines you can activate today. */
  purchasableLineCount: number;
}

export function computeBundlePricing(opts: {
  bundle: BusinessBundle;
  planPriceCents: number;
  catalogBySlug: Map<
    string,
    {
      name: string;
      price_cents: number;
      cadence: string;
      included_in_tier: string[];
      is_coming_soon: boolean;
    }
  >;
  currentTier: TierKey;
  activeSlugs: Set<string>;
  selectedOptionalSlugs: Set<string>;
}): BundlePricingSummary {
  const lines: BundlePricingLine[] = [];

  for (const ref of opts.bundle.addons) {
    const cat = opts.catalogBySlug.get(ref.slug);
    const catalogComingSoon = !cat || cat.is_coming_soon;
    const comingSoon =
      catalogComingSoon && !isShippedMarketplaceAddon(ref.slug);
    const optional = ref.optional === true;
    if (optional && !opts.selectedOptionalSlugs.has(ref.slug)) {
      continue;
    }

    const includedInTier = cat
      ? cat.included_in_tier.includes(opts.currentTier)
      : false;

    lines.push({
      slug: ref.slug,
      name: cat?.name ?? ref.plannedLabel ?? ref.slug,
      priceCents: cat?.price_cents ?? 0,
      monthly: cat ? cat.cadence === "monthly" || cat.cadence === "yearly" : true,
      comingSoon,
      optional,
      active: opts.activeSlugs.has(ref.slug),
      includedInTier,
    });
  }

  const addonSubtotalCents = lines.reduce((sum, line) => {
    if (line.active || line.includedInTier || line.comingSoon) return sum;
    return sum + line.priceCents;
  }, 0);

  const bundleAddonSubtotalCents = Math.round(
    addonSubtotalCents * (1 - BUNDLE_ADDON_DISCOUNT_RATE),
  );
  const savingsCents = addonSubtotalCents - bundleAddonSubtotalCents;
  const totalAlaCarteCents = opts.planPriceCents + addonSubtotalCents;
  const totalBundleCents = opts.planPriceCents + bundleAddonSubtotalCents;

  const stackLines = lines.filter((line) => !line.active && !line.includedInTier);
  const purchasableLineCount = stackLines.filter((line) => !line.comingSoon).length;
  const allStackComingSoon =
    stackLines.length > 0 && stackLines.every((line) => line.comingSoon);

  return {
    bundleId: opts.bundle.id,
    bundleName: opts.bundle.name,
    recommendedTier: opts.bundle.recommendedTier,
    planPriceCents: opts.planPriceCents,
    lines,
    addonSubtotalCents,
    bundleAddonSubtotalCents,
    savingsCents,
    totalAlaCarteCents,
    totalBundleCents,
    allStackComingSoon,
    purchasableLineCount,
  };
}
